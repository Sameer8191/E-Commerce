import crypto from "node:crypto";
import mongoose from "mongoose";
import Razorpay from "razorpay";
import Order from "../models/order.model.js";
import { notifyCustomerOrder } from "./customerNotificationService.js";
export const createRazorpayClient = () => {
  const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = process.env;
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    throw new Error("Razorpay credentials are not configured");
  }
  const client = new Razorpay({
    key_id: RAZORPAY_KEY_ID,
    key_secret: RAZORPAY_KEY_SECRET,
  });
  // The SDK does not expose a timeout option; bound network calls so claim
  // heartbeats cannot hold an order indefinitely on a stalled request.
  client.api.rq.defaults.timeout = 90_000;
  return client;
};

export const expectedPaise = (order) => {
  const value = order.totalAmount;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0)
    return null;
  const paise = Math.round(value * 100);
  return Number.isSafeInteger(paise) && Math.abs(value * 100 - paise) < 1e-7
    ? paise
    : null;
};

const refundPaymentStatus = (order, refundAmountPaise) => {
  const totalAmountPaise = expectedPaise(order);
  return totalAmountPaise !== null && refundAmountPaise < totalAmountPaise
    ? "partially_refunded"
    : "refunded";
};

export const verifySignature = (orderId, paymentId, signature, secret) => {
  if (
    typeof signature !== "string" ||
    !/^[a-f0-9]{64}$/i.test(signature) ||
    typeof orderId !== "string" ||
    typeof paymentId !== "string"
  )
    return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest();
  const received = Buffer.from(signature, "hex");
  return (
    received.length === expected.length &&
    crypto.timingSafeEqual(received, expected)
  );
};

// Shared idempotent state transition used by client verification and webhook.
export const applyCapturedPayment = async ({
  razorpayOrderId,
  razorpayPaymentId,
  paymentAmount,
  currency,
}) => {
  const session = await mongoose.startSession();
  let outcome;

  try {
    await session.withTransaction(async () => {
      const order = await Order.findOne({ razorpayOrderId }).session(session);
      if (!order) {
        outcome = { kind: "not_found" };
        return;
      }

      if (
        paymentAmount !== expectedPaise(order) ||
        currency !== (order.currency || "INR")
      ) {
        outcome = { kind: "mismatch", orderId: order._id };
        return;
      }

      if (order.orderStatus === "cancelled" || order.inventoryReleasedAt) {
        if (
          order.razorpayPaymentId === razorpayPaymentId &&
          order.refundStatus === "processed"
        ) {
          if (order.paymentStatus !== "refunded") {
            order.paymentStatus = "refunded";
            await order.save({ session });
          }
          outcome = { kind: "already_refunded", order };
          return;
        }

        // Record the captured payment and persist a refund task with the order.
        order.paymentStatus = "paid";
        order.razorpayPaymentId = razorpayPaymentId;
        order.refundPaymentId = razorpayPaymentId;
        if (!new Set(["processed", "processing"]).has(order.refundStatus)) {
          order.refundStatus = "pending";
          order.refundNextAttemptAt = new Date();
        }
        if (order.refundStatus !== "processing") order.refundError = null;
        await order.save({ session });
        outcome = { kind: "refund_required", order };
        return;
      }

      if (
        ["paid", "partially_refunded"].includes(order.paymentStatus) &&
        order.razorpayPaymentId === razorpayPaymentId
      ) {
        outcome = { kind: "already_paid", order };
        return;
      }

      const updated = await Order.findOneAndUpdate(
        {
          _id: order._id,
          paymentStatus: { $in: ["pending", "failed"] },
          orderStatus: { $ne: "cancelled" },
          inventoryReleasedAt: null,
          razorpayOrderId,
        },
        {
          $set: {
            paymentStatus: "paid",
            razorpayPaymentId,
            paymentMethod: "razorpay",
            orderStatus: "confirmed",
            "vendorOrders.$[].fulfillmentStatus": "confirmed",
          },
        },
        { new: true, session, runValidators: true },
      );

      if (!updated) {
        const latest = await Order.findById(order._id).session(session);
        if (
          latest?.paymentStatus === "paid" &&
          latest.razorpayPaymentId === razorpayPaymentId
        ) {
          outcome = { kind: "already_paid", order: latest };
        } else {
          outcome = { kind: "conflict", order: latest };
        }
        return;
      }

      outcome = { kind: "paid", order: updated };
    });
    if (outcome?.kind === "paid" && outcome.order) {
      void notifyCustomerOrder({
        order: outcome.order,
        eventKey: `order:${outcome.order._id}:payment-confirmed`,
        title: "Payment confirmed",
        message: `Payment for order ${outcome.order.orderNumber} is confirmed. We’ll start preparing your order.`,
        subject: `Payment confirmed for order ${outcome.order.orderNumber}`,
      });
    }
    return outcome;
  } finally {
    await session.endSession();
  }
};



export const attemptRefund = async (orderId) => {
  const now = new Date();
  const leaseExpired = new Date(now.getTime() - 5 * 60 * 1000);
  const order = await Order.findOneAndUpdate(
    {
      _id: orderId,
      refundPaymentId: { $type: "string" },
      $or: [
        { orderStatus: "cancelled" },
        { "returnRequest.status": "approved" },
      ],
      $and: [{
        $or: [
          { refundStatus: { $in: ["pending", "failed"] }, refundNextAttemptAt: { $lte: now } },
          { refundStatus: "processing", updatedAt: { $lte: leaseExpired } },
        ],
      }],
    },
    {
      $set: { refundStatus: "processing", refundError: null },
      $inc: { refundAttempts: 1 },
    },
    { new: true, runValidators: true },
  );
  if (!order) return { claimed: false };

  const delayMinutes = Math.min(60, 2 ** Math.min(order.refundAttempts, 6));
  const retry = async (error) => Order.updateOne(
    { _id: order._id, refundStatus: "processing" },
    {
      $set: {
        refundStatus: "failed",
        refundNextAttemptAt: new Date(Date.now() + delayMinutes * 60_000),
        refundError: String(error?.message || error).slice(0, 1000),
      },
    },
  );

  try {
    const amount = expectedPaise({
      totalAmount: order.returnRequest?.status === "approved"
        ? order.returnRequest.refundAmount
        : order.totalAmount,
    });
    if (!Number.isSafeInteger(amount)) throw new Error("Invalid refund amount");
    const receipt = order.refundReceipt || `ord-${order._id.toString()}-${order.refundAttempts}`;
    if (!order.refundReceipt) {
      const receiptUpdate = await Order.updateOne(
        { _id: order._id, refundStatus: "processing", refundReceipt: null },
        { $set: { refundReceipt: receipt } },
      );
      if (receiptUpdate.modifiedCount !== 1) {
        throw new Error("Could not persist refund receipt before gateway request");
      }
    }
    const payments = createRazorpayClient().payments;

    // First reconcile a prior request that may have succeeded while its HTTP
    // response was lost. Each retry uses a new receipt after a confirmed failure.
    const refunds = await payments.fetchMultipleRefund(order.refundPaymentId, { count: 100 });
    const relatedRefunds = (refunds.items || []).filter((item) =>
      typeof item.receipt === "string" && item.receipt.startsWith(`ord-${order._id.toString()}-`),
    );
    const confirmedRefund = relatedRefunds.find((item) => item.status === "processed");
    if (confirmedRefund) {
      await Order.updateOne(
        { _id: order._id, refundStatus: "processing" },
        {
          $set: {
            refundStatus: "processed",
            paymentStatus: refundPaymentStatus(order, amount),
            refundNextAttemptAt: null,
            refundError: null,
            ...(order.returnRequest?.status === "approved" && { "returnRequest.status": "refunded" }),
          },
        },
      );
      void notifyCustomerOrder({
        order,
        eventKey: `order:${order._id}:refund-processed`,
        title: "Refund processed",
        message: `The refund for order ${order.orderNumber} has been processed by the payment provider.`,
        subject: `Refund update for order ${order.orderNumber}`,
      });
      return { claimed: true, reconciled: true };
    }
    const pendingRefund = relatedRefunds.find((item) => item.status === "pending");
    if (pendingRefund) {
      await Order.updateOne(
        { _id: order._id, refundStatus: "processing" },
        { $set: { refundStatus: "pending", refundNextAttemptAt: new Date(Date.now() + 5 * 60_000), refundError: null } },
      );
      return { claimed: true, reconciled: true };
    }

    let refund = relatedRefunds.find((item) => item.receipt === receipt);
    if (!refund) {
      refund = await payments.refund(order.refundPaymentId, {
        amount,
        receipt,
        notes: {
          localOrderId: order._id.toString(),
          reason: order.returnRequest?.status === "approved"
            ? `Customer return: ${order.returnRequest.reason || "reason not supplied"}`
            : "Payment captured after order cancellation",
        },
      });
    }

    if (refund.status === "processed") {
      await Order.updateOne(
        { _id: order._id, refundStatus: "processing" },
        {
          $set: {
            refundStatus: "processed",
            paymentStatus: refundPaymentStatus(order, amount),
            refundNextAttemptAt: null,
            refundError: null,
            ...(order.returnRequest?.status === "approved" && { "returnRequest.status": "refunded" }),
          },
        },
      );
      void notifyCustomerOrder({
        order,
        eventKey: `order:${order._id}:refund-processed`,
        title: "Refund processed",
        message: `The refund for order ${order.orderNumber} has been processed by the payment provider.`,
        subject: `Refund update for order ${order.orderNumber}`,
      });
    } else {
      const isFailed = refund.status === "failed";
      await Order.updateOne(
        { _id: order._id, refundStatus: "processing" },
        {
          $set: {
            refundStatus: isFailed ? "failed" : "pending",
            refundNextAttemptAt: new Date(Date.now() + (isFailed ? delayMinutes : 5) * 60_000),
            ...(isFailed && { refundReceipt: null }),
            refundError: isFailed ? "Razorpay reported refund failure" : null,
          },
        },
      );
    }
    return { claimed: true };
  } catch (error) {
    console.error("Refund reconciliation failed:", { orderId: String(order._id), error: error.message });
    await retry(error);
    return { claimed: true, error };
  }
};
