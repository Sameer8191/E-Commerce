import mongoose from "mongoose";

const adminNotificationSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, maxlength: 150 },
    type: { type: String, enum: ["low_stock", "return_request"], required: true },
    entityId: { type: String, required: true, maxlength: 100 },
    title: { type: String, required: true, maxlength: 160 },
    message: { type: String, required: true, maxlength: 300 },
    active: { type: Boolean, default: true, required: true },
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

adminNotificationSchema.index({ active: 1, readBy: 1, updatedAt: -1 });

export default mongoose.model("AdminNotification", adminNotificationSchema);
