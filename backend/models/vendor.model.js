import mongoose from "mongoose";

const vendorSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    storeName: { type: String, required: true, trim: true, maxlength: 100 },
    slug: { type: String, required: true, trim: true, lowercase: true, unique: true },
    description: { type: String, trim: true, maxlength: 1000, default: "" },
    contactEmail: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, trim: true, maxlength: 30, default: "" },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "suspended"],
      default: "pending",
      required: true,
      index: true,
    },
    isPlatform: { type: Boolean, default: false, index: true },
    commissionRate: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
      validate: {
        validator: (value) =>
          value == null || Math.abs(value * 100 - Math.round(value * 100)) < 1e-8,
        message: "Commission rate must have no more than two decimal places",
      },
    },
    applicationNote: { type: String, trim: true, maxlength: 1000, default: "" },
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

vendorSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model("Vendor", vendorSchema);
