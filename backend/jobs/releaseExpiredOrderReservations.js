import mongoose from "mongoose";
import Order from "../models/order.model.js";
import Product from "../models/product.model.js";

export const releaseExpiredOrderReservations = async (now = new Date()) => {
  const expiredOrders = await Order.find({
    paymentMethod: "razorpay",
    paymentStatus: { $in: ["pending", "failed"] },
    orderStatus: "pending",
    inventoryReleasedAt: null,
    inventoryExpiresAt: { $lte: now },
    $or: [
      { paymentOrderCreationExpiresAt: null },
      { paymentOrderCreationExpiresAt: { $lte: now } },
    ],
  })
    .select("_id")
    .lean();

  let released = 0;
  let skipped = 0;

  for (const { _id } of expiredOrders) {
    const session = await mongoose.startSession();
    try {
      let didRelease = false;
      await session.withTransaction(async () => {
        didRelease = false;
        const order = await Order.findOneAndUpdate(
          {
            _id,
            paymentMethod: "razorpay",
            paymentStatus: { $in: ["pending", "failed"] },
            orderStatus: "pending",
            inventoryReleasedAt: null,
            inventoryExpiresAt: { $lte: now },
            $or: [
              { paymentOrderCreationExpiresAt: null },
              { paymentOrderCreationExpiresAt: { $lte: now } },
            ],
          },
          {
            $set: {
              orderStatus: "cancelled",
              inventoryReleasedAt: now,
              inventoryExpiresAt: null,
            },
          },
          { new: true, session, runValidators: true },
        );

        if (!order) return;

        for (const item of order.items) {
          const result = await Product.updateOne(
            { _id: item.product },
            { $inc: { stock: item.quantity } },
            { session },
          );
          if (result.matchedCount !== 1) {
            throw new Error(`Missing product ${item.product} while releasing order ${order._id}`);
          }
        }
        didRelease = true;
      });

      if (didRelease) released += 1;
      else skipped += 1;
    } finally {
      await session.endSession();
    }
  }

  return { examined: expiredOrders.length, released, skipped };
};
