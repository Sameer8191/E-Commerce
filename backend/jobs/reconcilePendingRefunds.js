import Order from "../models/order.model.js";
import { attemptRefund } from "../services/paymentService.js";

export const reconcilePendingRefunds = async () => {
  const now = new Date();
  const staleProcessing = new Date(now.getTime() - 5 * 60 * 1000);
  const orders = await Order.find({
    refundPaymentId: { $type: "string" },
    $or: [
      { orderStatus: "cancelled" },
      { "returnRequest.status": "approved" },
    ],
    $and: [{
      $or: [
      {
        refundStatus: { $in: ["pending", "failed"] },
        refundNextAttemptAt: { $lte: now },
      },
      { refundStatus: "processing", updatedAt: { $lte: staleProcessing } },
      ],
    }],
  })
    .select("_id")
    .limit(100)
    .lean();

  let claimed = 0;
  for (const { _id } of orders) {
    if ((await attemptRefund(_id)).claimed) claimed += 1;
  }

  return { examined: orders.length, claimed };
};
