import mongoose from "mongoose";
import Order from "../models/order.model.js";
import Product from "../models/product.model.js";
import AdminNotification from "../models/admin-notification.model.js";
import isValidObjectId from "../utils/validateObjectId.js";
import { createHttpError, sendError } from "../utils/order.utils.js";
import { getUserId } from "../utils/auth.utils.js";
import { notifyCustomerOrder } from "../services/customerNotificationService.js";
import { calculatePartialReturn } from "../utils/return.utils.js";

// GET /api/orders
export const getMyOrders = async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);
    if (
      !Number.isSafeInteger(page) ||
      page < 1 ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 100 ||
      !Number.isSafeInteger((page - 1) * limit)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid pagination parameters",
      });
    }

    const filter = { user: userId };
    const [orders, total] = await Promise.all([
      Order.find(filter)
        .sort({ placedAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),

      Order.countDocuments(filter),
    ]);
    const currentTime = Date.now();
    const ordersWithReturnEligibility = orders.map((order) => {
      const deliveredAt = order.deliveredAt || order.updatedAt || order.placedAt;
      const deliveredTime = new Date(deliveredAt).getTime();
      return {
        ...order,
        returnEligible: order.orderStatus === "delivered"
          && order.paymentStatus === "paid"
          && (!order.returnRequest?.status || order.returnRequest.status === "none")
          && Number.isFinite(deliveredTime)
          && currentTime - deliveredTime >= 0
          && currentTime - deliveredTime <= RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000,
      };
    });

    return res.status(200).json({
      success: true,
      data: ordersWithReturnEligibility,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return sendError(res, error, "Failed to fetch orders");
  }
};

// GET /api/orders/:orderId
export const getOrderById = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { orderId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!isValidObjectId(orderId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    const order = await Order.findOne({ _id: orderId, user: userId }).lean();

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    return res.status(200).json({ success: true, data: order });
  } catch (error) {
    return sendError(res, error, "Failed to fetch order");
  }
};

const RETURN_REASONS = ["defective", "wrong_item", "not_as_described", "changed_mind", "other"];
const RETURN_WINDOW_DAYS = 30;

export const createReturnRequest = async (req, res) => {
  const userId = getUserId(req);
  const { orderId } = req.params;
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
  const details = typeof req.body?.details === "string" ? req.body.details.trim() : "";
  const requestedItems = req.body?.items;

  if (!isValidObjectId(orderId)) {
    return res.status(400).json({ success: false, message: "Invalid order ID" });
  }
  if (!RETURN_REASONS.includes(reason)) {
    return res.status(400).json({ success: false, message: "Choose a valid return reason" });
  }
  if (req.body?.details !== undefined && typeof req.body.details !== "string") {
    return res.status(400).json({ success: false, message: "Return details must be text" });
  }
  if (details.length > 500) {
    return res.status(400).json({ success: false, message: "Return details must be 500 characters or fewer" });
  }
  if (!Array.isArray(requestedItems)) {
    return res.status(400).json({ success: false, message: "Choose the items and quantities to return" });
  }

  const now = new Date();
  const eligibleSince = new Date(now.getTime() - RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  let session;
  try {
    session = await mongoose.startSession();
    let requestOrder = null;
    let failure = null;
    let idempotentReplay = false;
    await session.withTransaction(async () => {
      requestOrder = null;
      failure = null;
      idempotentReplay = false;
      const order = await Order.findOne({
        _id: orderId,
        user: userId,
        orderStatus: "delivered",
        paymentStatus: "paid",
        "returnRequest.status": { $in: ["none", null] },
        $or: [
          { deliveredAt: { $gte: eligibleSince } },
          { deliveredAt: null, updatedAt: { $gte: eligibleSince } },
        ],
      }).session(session);

      if (!order) {
        const existing = await Order.findOne({ _id: orderId, user: userId }).session(session);
        if (!existing) failure = { status: 404, message: "Order not found" };
        else if (existing.orderStatus !== "delivered") failure = { status: 409, message: "Returns are available after delivery only" };
        else if (existing.paymentStatus !== "paid") failure = { status: 409, message: "Only paid orders can be returned" };
        else if (
          existing.returnRequest?.status === "requested"
          && existing.returnRequest.reason === reason
          && existing.returnRequest.details === details
          && requestedItems.length === (existing.returnRequest.items || []).length
          && requestedItems.every((item) => existing.returnRequest.items.some((saved) =>
            String(saved.product) === item.productId && saved.quantity === item.quantity,
          ))
        ) {
          requestOrder = existing;
          idempotentReplay = true;
        } else if (existing.returnRequest?.status && existing.returnRequest.status !== "none") failure = { status: 409, message: "A return request already exists for this order" };
        else failure = { status: 409, message: `Returns must be requested within ${RETURN_WINDOW_DAYS} days of delivery` };
        return;
      }

      if (order.vendorOrders.some((vendorOrder) => vendorOrder.settlementStatus === "paid")) {
        failure = { status: 409, message: "A seller settlement has already completed. Contact customer care for return assistance." };
        return;
      }
      let returnDetails;
      try {
        returnDetails = calculatePartialReturn(order, requestedItems);
      } catch (error) {
        failure = { status: error.httpStatus || 400, message: error.message };
        return;
      }
      order.returnRequest = {
        status: "requested",
        reason,
        details,
        items: returnDetails.items,
        refundAmount: returnDetails.refundAmountPaise / 100,
        requestedAt: now,
        reviewedAt: null,
        reviewedBy: null,
        reviewNote: "",
      };
      await order.save({ session });
      const notificationKey = `return:${order._id}`;
      await AdminNotification.findOneAndUpdate(
        { key: notificationKey },
        {
          $set: {
            type: "return_request",
            entityId: String(order._id),
            title: "New return request",
            message: `Order ${order.orderNumber}: ${reason.replaceAll("_", " ")}`,
            active: true,
            readBy: [],
            metadata: { orderNumber: order.orderNumber, reason },
          },
        },
        { upsert: true, new: true, runValidators: true, session },
      );
      requestOrder = order;
    });

    if (failure) return res.status(failure.status).json({ success: false, message: failure.message });
    if (!idempotentReplay && requestOrder) {
      void notifyCustomerOrder({
        order: requestOrder,
        eventKey: `order:${requestOrder._id}:return-requested`,
        title: "Return request received",
        message: `Your return request for order ${requestOrder.orderNumber} is with our team for review.`,
        subject: `Return request received for order ${requestOrder.orderNumber}`,
      });
    }
    return res.status(idempotentReplay ? 200 : 201).json({
      success: true,
      message: idempotentReplay ? "Return request is already awaiting review" : "Return request submitted for review",
      data: requestOrder,
    });
  } catch (error) {
    return sendError(res, error, "Failed to submit return request");
  } finally {
    if (session) await session.endSession();
  }
};

// PATCH /api/orders/:orderId/cancel
export const cancelOrder = async (req, res) => {
  const userId = getUserId(req);
  const { orderId } = req.params;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  if (!isValidObjectId(orderId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid order ID",
    });
  }

  let session;

  try {
    session = await mongoose.startSession();

    let cancelledOrder = null;

    await session.withTransaction(async () => {
      cancelledOrder = null;

      // Conditional transition and restock share one transaction.
      const order = await Order.findOne({
        _id: orderId,
        user: userId,
        orderStatus: { $in: ["pending", "confirmed"] },
        paymentStatus: { $in: ["pending", "failed"] },
        inventoryReleasedAt: null,
        $or: [
          { paymentOrderCreationExpiresAt: null },
          { paymentOrderCreationExpiresAt: { $lte: new Date() } },
        ],
      }).session(session);

      if (!order) {
        const existing = await Order.findOne({
          _id: orderId,
          user: userId,
        }).session(session);

        if (!existing) {
          throw createHttpError(404, "Order not found");
        }

        throw createHttpError(409, "This order can no longer be cancelled");
      }

      // Save the state transition in the same transaction as inventory
      // restoration. A competing payment transition should write the same
      // order document and cause one transaction to conflict/abort.
      order.orderStatus = "cancelled";
      order.vendorOrders.forEach((vendorOrder) => {
        if (!["cancelled", "delivered"].includes(vendorOrder.fulfillmentStatus)) {
          vendorOrder.fulfillmentStatus = "cancelled";
        }
      });
      order.inventoryReleasedAt = new Date();
      order.inventoryExpiresAt = null;
      await order.save({ session });

      for (const item of order.items) {
        const result = await Product.updateOne(
          { _id: item.product },
          { $inc: { stock: item.quantity } },
          { session },
        );

        if (result.matchedCount !== 1) {
          throw createHttpError(
            409,
            `Unable to release inventory for product ${item.product}`,
          );
        }
      }

      cancelledOrder = order;
    });

    void notifyCustomerOrder({
      order: cancelledOrder,
      eventKey: `order:${cancelledOrder._id}:cancelled`,
      title: "Order cancelled",
      message: `Order ${cancelledOrder.orderNumber} was cancelled. Any eligible refund will be shown in Your orders.`,
      subject: `Order ${cancelledOrder.orderNumber} cancelled`,
    });
    return res.status(200).json({
      success: true,
      message: "Order cancelled successfully",
      data: cancelledOrder,
    });
  } catch (error) {
    return sendError(res, error, "Failed to cancel order");
  } finally {
    if (session) {
      await session.endSession();
    }
  }
};
