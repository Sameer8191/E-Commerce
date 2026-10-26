import crypto from "node:crypto";
import mongoose from "mongoose";
import Order from "../models/order.model.js";
import { getUserId } from "../utils/auth.utils.js";
import {
  applyCapturedPayment,
  attemptRefund,
  createRazorpayClient,
  expectedPaise,
  verifySignature,
} from "../services/paymentService.js";

const PAYMENT_ORDER_CLAIM_LEASE_MS = 10 * 60 * 1000;
const PAYMENT_ORDER_CLAIM_HEARTBEAT_MS = 60 * 1000;

const startPaymentOrderClaimHeartbeat = (orderId, creationToken) => {
  let stopped = false;
  const timer = setInterval(async () => {
    if (stopped) return;
    try {
      const result = await Order.updateOne(
        { _id: orderId, paymentOrderCreationToken: creationToken },
        {
          $set: {
            paymentOrderCreationExpiresAt: new Date(
              Date.now() + PAYMENT_ORDER_CLAIM_LEASE_MS,
            ),
          },
        },
      );
      if (result.matchedCount !== 1) stopped = true;
    } catch (error) {
      // The long initial lease remains in place during transient DB errors.
      console.error("Payment order claim heartbeat failed:", error.message);
    }
  }, PAYMENT_ORDER_CLAIM_HEARTBEAT_MS);
  timer.unref?.();

  return () => {
    stopped = true;
    clearInterval(timer);
  };
};

const findOrderByReceipt = async (razorpay, order, amount) => {
  const result = await razorpay.orders.all({
    receipt: order.orderNumber,
    count: 100,
  });
  const matchingOrders = (result.items ?? []).filter(
    (item) => item.receipt === order.orderNumber,
  );

  if (matchingOrders.length > 1) {
    throw new Error("Multiple Razorpay orders share the local order receipt");
  }

  const existing = matchingOrders[0];
  if (!existing) return null;
  if (
    existing.notes?.localOrderId !== order._id.toString() ||
    existing.amount !== amount ||
    existing.currency !== (order.currency || "INR")
  ) {
    throw new Error("Razorpay order receipt does not match the local order");
  }

  return existing;
};


// POST /api/payments/razorpay/order
export const createRazorpayOrder = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { orderId } = req.body ?? {};
    if (!userId)
      return res
        .status(401)
        .json({ success: false, message: "Authentication required" });
    if (!mongoose.isValidObjectId(orderId))
      return res
        .status(400)
        .json({ success: false, message: "Invalid order ID" });

    const order = await Order.findOne({ _id: orderId, user: userId });
    if (!order)
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    if (
      order.paymentMethod !== "razorpay" ||
      !["pending", "failed"].includes(order.paymentStatus) ||
      order.orderStatus === "cancelled" ||
      order.inventoryReleasedAt ||
      (order.inventoryExpiresAt && order.inventoryExpiresAt <= new Date())
    ) {
      return res
        .status(409)
        .json({ success: false, message: "This order cannot be paid" });
    }

    const amount = expectedPaise(order);
    const maxAmount = Number(process.env.MAX_ORDER_AMOUNT_PAISE || 100_000_000);
    if (!Number.isSafeInteger(amount) || amount < 100 || amount > maxAmount) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid order amount" });
    }

    const razorpay = createRazorpayClient();
    let rpOrder = null;

    if (order.razorpayOrderId) {
      let existing;
      try {
        existing = await razorpay.orders.fetch(order.razorpayOrderId);
      } catch (error) {
        console.error("Unable to fetch existing Razorpay order:", error.message);
        return res.status(503).json({
          success: false,
          message: "Unable to check the existing payment order; please retry",
        });
      }

      if (
        (existing.status !== "created" && existing.status !== "attempted") ||
        existing.amount !== amount ||
        existing.currency !== (order.currency || "INR")
      ) {
        return res.status(409).json({
          success: false,
          message: "The existing payment order cannot be retried; please check your order status",
        });
      }

      rpOrder = existing;
    } else {
      try {
        rpOrder = await findOrderByReceipt(razorpay, order, amount);
      } catch (error) {
        console.error("Unable to reconcile Razorpay order receipt:", error);
        return res.status(503).json({
          success: false,
          message: "Unable to check the existing payment order; please retry",
        });
      }
    }

    if (!order.razorpayOrderId) {
      const creationToken = crypto.randomUUID();
      const now = new Date();
      const claimExpiresAt = new Date(now.getTime() + PAYMENT_ORDER_CLAIM_LEASE_MS);
      const claim = await Order.findOneAndUpdate(
        {
          _id: order._id,
          user: userId,
          paymentMethod: "razorpay",
          paymentStatus: { $in: ["pending", "failed"] },
          orderStatus: { $ne: "cancelled" },
          inventoryReleasedAt: null,
          $and: [
            {
              $or: [
                { razorpayOrderId: null },
                { razorpayOrderId: { $exists: false } },
              ],
            },
            { $or: [{ inventoryExpiresAt: null }, { inventoryExpiresAt: { $gt: now } }] },
            {
              $or: [
                { paymentOrderCreationExpiresAt: null },
                { paymentOrderCreationExpiresAt: { $lte: now } },
              ],
            },
          ],
        },
        {
          $set: {
            paymentOrderCreationToken: creationToken,
            paymentOrderCreationExpiresAt: claimExpiresAt,
          },
        },
        { new: true },
      );

      if (!claim) {
        return res.set("Retry-After", "60").status(409).json({
          success: false,
          message: "Payment order creation is already in progress; retry shortly",
        });
      }

      const stopHeartbeat = startPaymentOrderClaimHeartbeat(order._id, creationToken);
      try {
        if (!rpOrder) {
          try {
            rpOrder = await razorpay.orders.create({
              amount,
              currency: order.currency || "INR",
              receipt: order.orderNumber,
              notes: { localOrderId: order._id.toString() },
            });
          } catch (error) {
            console.error("Razorpay order creation returned an error:", error);
            try {
              rpOrder = await findOrderByReceipt(razorpay, order, amount);
            } catch (lookupError) {
              console.error(
                "Unable to reconcile the Razorpay order after creation error:",
                lookupError,
              );
            }

            if (!rpOrder) {
              // Keep the lease until it expires. A retry checks the receipt
              // before attempting another provider order.
              const retryAfterSeconds =
                PAYMENT_ORDER_CLAIM_LEASE_MS / 1000 +
                PAYMENT_ORDER_CLAIM_HEARTBEAT_MS / 1000 +
                90;
              return res.set("Retry-After", String(retryAfterSeconds)).status(503).json({
                success: false,
                message: "Payment order creation could not be confirmed; retry after the reconciliation window",
              });
            }
          }
        }

        const updated = await Order.findOneAndUpdate(
          {
            _id: order._id,
            user: userId,
            paymentOrderCreationToken: creationToken,
            paymentStatus: { $in: ["pending", "failed"] },
            orderStatus: { $ne: "cancelled" },
            inventoryReleasedAt: null,
            $or: [
              { inventoryExpiresAt: null },
              { inventoryExpiresAt: { $gt: new Date() } },
            ],
          },
          {
            $set: { razorpayOrderId: rpOrder.id },
            $unset: {
              paymentOrderCreationToken: 1,
              paymentOrderCreationExpiresAt: 1,
            },
          },
          { new: true, runValidators: true },
        );

        if (!updated) {
          await Order.updateOne(
            { _id: order._id, paymentOrderCreationToken: creationToken },
            {
              $set: {
                paymentOrderCreationToken: null,
                paymentOrderCreationExpiresAt: null,
              },
            },
          );
          return res.status(409).json({
            success: false,
            message: "Order changed during payment setup; check the order before retrying",
          });
        }
      } finally {
        stopHeartbeat();
      }

    }

    if (
      rpOrder.status !== "created" &&
      rpOrder.status !== "attempted"
    ) {
      return res.status(409).json({
        success: false,
        message:
          "The existing payment order cannot be retried; please check your order status",
      });
    }

    return res.status(200).json({
      success: true,
      key: process.env.RAZORPAY_KEY_ID,
      razorpayOrderId: rpOrder.id,
      amount: rpOrder.amount,
      currency: rpOrder.currency,
    });
  } catch (error) {
    console.error("createRazorpayOrder:", error);
    return res
      .status(500)
      .json({ success: false, message: "Unable to create payment order" });
  }
};

// POST /api/payments/razorpay/verify
export const verifyRazorpayPayment = async (req, res) => {
  try {
    const userId = getUserId(req);
    const {
      orderId,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body ?? {};

    if (!userId)
      return res
        .status(401)
        .json({ success: false, message: "Authentication required" });
    if (
      !mongoose.isValidObjectId(orderId) ||
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature
    ) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid payment details" });
    }

    const order = await Order.findOne({ _id: orderId, user: userId });
    if (!order)
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    if (order.razorpayOrderId !== razorpay_order_id) {
      return res
        .status(400)
        .json({ success: false, message: "Razorpay order does not match" });
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) throw new Error("Razorpay secret is not configured");
    if (
      !verifySignature(
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        secret,
      )
    ) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid payment signature" });
    }

    const payment = await createRazorpayClient().payments.fetch(razorpay_payment_id);
    if (payment.order_id !== razorpay_order_id) {
      return res
        .status(400)
        .json({ success: false, message: "Payment order does not match" });
    }
    if (payment.status !== "captured") {
      return res
        .status(409)
        .json({
          success: false,
          message: "Payment has not been captured",
          paymentStatus: payment.status,
        });
    }

    const result = await applyCapturedPayment({
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      paymentAmount: payment.amount,
      currency: payment.currency,
    });

    if (result.kind === "refund_required") {
      await attemptRefund(result.order._id);
      return res
        .status(409)
        .json({
          success: false,
          message: "Order was cancelled; payment refund is being reconciled",
        });
    }
    if (result.kind === "mismatch")
      return res
        .status(400)
        .json({
          success: false,
          message: "Payment amount or currency does not match",
        });
    if (result.kind === "not_found")
      return res
        .status(404)
        .json({ success: false, message: "Order not found for payment" });
    if (result.kind === "conflict")
      return res
        .status(409)
        .json({
          success: false,
          message: "Order status changed; please check your order",
        });

    return res.status(200).json({
      success: true,
      message:
        result.kind === "already_paid"
          ? "Payment already verified"
          : "Payment verified successfully",
      order: result.order,
    });
  } catch (error) {
    console.error("verifyRazorpayPayment:", error);
    return res
      .status(500)
      .json({ success: false, message: "Unable to verify payment" });
  }
};
