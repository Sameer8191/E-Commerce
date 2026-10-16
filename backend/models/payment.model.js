
import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    provider: {
      type: String,
      enum: ["razorpay", "stripe"],
      required: true,
    },

    providerOrderId: {
      type: String,
      default: null,
    },

    providerPaymentId: {
      type: String,
      default: null,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: (value) => Number.isFinite(value) && Math.abs(value * 100 - Math.round(value * 100)) < 1e-8,
        message: "Amount must have no more than two decimal places",
      },
    },

    currency: {
      type: String,
      required: true,
      default: "INR",
      uppercase: true,
      trim: true,
    },

    status: {
      type: String,
      enum: [
        "created",
        "pending",
        "succeeded",
        "failed",
        "refunded",
      ],
      default: "created",
      required: true,
    },

    failureReason: {
      type: String,
      default: null,
      trim: true,
    },

    paidAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

paymentSchema.index({ order: 1, createdAt: -1 });
paymentSchema.index(
  { provider: 1, providerOrderId: 1 },
  { unique: true, partialFilterExpression: { providerOrderId: { $type: "string" } } }
);
paymentSchema.index(
  { provider: 1, providerPaymentId: 1 },
  { unique: true, partialFilterExpression: { providerPaymentId: { $type: "string" } } }
);

const Payment = mongoose.model("Payment", paymentSchema);

export default Payment;
