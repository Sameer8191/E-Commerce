import mongoose from "mongoose";

const paymentEventSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true, unique: true, trim: true },
    eventType: { type: String, required: true, trim: true },
    razorpayPaymentId: { type: String, default: null },
    razorpayOrderId: { type: String, default: null },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null },
    status: { type: String, enum: ["received", "processed", "failed"], default: "received" },
    processingError: { type: String, default: null, maxlength: 1000 },
    processedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

paymentEventSchema.index({ status: 1, updatedAt: 1 });

export default mongoose.model("PaymentEvent", paymentEventSchema);
