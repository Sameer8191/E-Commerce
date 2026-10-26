import crypto from "node:crypto";
import PaymentEvent from "../models/payment-event.model.js";
import Order from "../models/order.model.js";
import { applyCapturedPayment, attemptRefund } from "../services/paymentService.js";
import { notifyCustomerOrder } from "../services/customerNotificationService.js";

export const razorpayWebhook = async (req, res) => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const signature = req.get("x-razorpay-signature");
  const eventId = req.get("x-razorpay-event-id");

  if (
    !webhookSecret ||
    !Buffer.isBuffer(req.rawBody) ||
    !signature ||
    !eventId
  ) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid webhook request" });
  }

  const expected = crypto
    .createHmac("sha256", webhookSecret)
    .update(req.rawBody)
    .digest();
  let received;
  try {
    if (!/^[a-f0-9]{64}$/i.test(signature))
      throw new Error("Bad signature format");
    received = Buffer.from(signature, "hex");
  } catch {
    return res
      .status(400)
      .json({ success: false, message: "Invalid webhook signature" });
  }
  if (
    received.length !== expected.length ||
    !crypto.timingSafeEqual(received, expected)
  ) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid webhook signature" });
  }

  let payload;
  try {
    payload = JSON.parse(req.rawBody.toString("utf8"));
  } catch {
    return res
      .status(400)
      .json({ success: false, message: "Invalid webhook payload" });
  }

  const eventType = payload.event;
  const paymentEntity = payload.payload?.payment?.entity;
  let eventDoc;

  try {
    try {
      [eventDoc] = await PaymentEvent.create([
        {
          eventId,
          eventType,
          razorpayPaymentId: paymentEntity?.id || null,
          razorpayOrderId: paymentEntity?.order_id || null,
          status: "received",
        },
      ]);
    } catch (error) {
      if (error.code !== 11000) throw error;

      const existing = await PaymentEvent.findOne({ eventId }).lean();
      if (!existing) throw error;
      if (existing.status === "processed") {
        return res.status(200).json({ success: true, duplicate: true });
      }

      // Claim failed events or events left in-flight by a crashed process. The
      // conditional update prevents concurrent deliveries processing together.
      const staleBefore = new Date(Date.now() - 2 * 60 * 1000);
      const claim = await PaymentEvent.updateOne(
        {
          _id: existing._id,
          $or: [
            { status: "failed" },
            { status: "received", updatedAt: { $lte: staleBefore } },
          ],
        },
        { $set: { status: "received", processingError: null } },
      );
      if (claim.modifiedCount !== 1) {
        return res.status(503).json({ success: false, message: "Webhook is already being processed; retry later" });
      }
      eventDoc = existing;
    }

    if (!paymentEntity?.order_id || !paymentEntity?.id) {
      await PaymentEvent.updateOne(
        { _id: eventDoc._id },
        { $set: { status: "processed", processedAt: new Date() } },
      );
      return res.status(200).json({ success: true });
    }

    if (eventType === "payment.captured") {
      const result = await applyCapturedPayment({
        razorpayOrderId: paymentEntity.order_id,
        razorpayPaymentId: paymentEntity.id,
        paymentAmount: paymentEntity.amount,
        currency: paymentEntity.currency,
      });

      if (result.kind === "refund_required") {
        await attemptRefund(result.order._id);
      } else if (result.kind === "mismatch") {
        throw new Error("Captured payment amount/currency mismatch");
      } else if (
        !["paid", "already_paid", "already_refunded"].includes(result.kind)
      ) {
        throw new Error(
          `Captured payment could not be reconciled: ${result.kind}`,
        );
      }
      if (result.order?._id) {
        await PaymentEvent.updateOne(
          { _id: eventDoc._id },
          { $set: { order: result.order._id } },
        );
      }
    } else if (eventType === "payment.failed") {
      const result = await Order.updateOne(
        {
          razorpayOrderId: paymentEntity.order_id,
          paymentStatus: "pending",
          orderStatus: { $ne: "cancelled" },
        },
        { $set: { paymentStatus: "failed" } },
      );
      if (result.modifiedCount === 1) {
        const order = await Order.findOne({ razorpayOrderId: paymentEntity.order_id }).lean();
        if (order) void notifyCustomerOrder({
          order,
          eventKey: `order:${order._id}:payment-failed:${paymentEntity.id}`,
          title: "Payment was not completed",
          message: `Payment for order ${order.orderNumber} was not completed. You can review the order and try again from Your orders.`,
          subject: `Payment update for order ${order.orderNumber}`,
        });
      }
    }

    await PaymentEvent.updateOne(
      { _id: eventDoc._id },
      { $set: { status: "processed", processedAt: new Date() } },
    );
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Razorpay webhook processing error:", error);
    if (eventDoc?._id) {
      await PaymentEvent.updateOne(
        { _id: eventDoc._id },
        {
          $set: {
            status: "failed",
            processingError: String(error.message || error).slice(0, 1000),
          },
        },
      );
    }
    return res
      .status(500)
      .json({ success: false, message: "Webhook processing failed" });
  }
};
