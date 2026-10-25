import mongoose from "mongoose";

const vendorSettlementSchema = new mongoose.Schema(
  {
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
      index: true,
    },
    orders: [
      {
        order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
        vendorOrder: { type: mongoose.Schema.Types.ObjectId, required: true },
        orderNumber: { type: String, required: true },
        amount: { type: Number, required: true, min: 0 },
      },
    ],
    totalAmount: { type: Number, required: true, min: 0 },
    reference: { type: String, required: true, trim: true, maxlength: 200 },
    paidAt: { type: Date, required: true, default: Date.now },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

vendorSettlementSchema.index({ vendor: 1, paidAt: -1 });
vendorSettlementSchema.index({ "orders.order": 1, "orders.vendorOrder": 1 }, { unique: true });

export default mongoose.model("VendorSettlement", vendorSettlementSchema);
