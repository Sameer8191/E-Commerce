import mongoose from "mongoose";

const customerNotificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null },
    eventKey: { type: String, required: true, unique: true, maxlength: 180 },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    message: { type: String, required: true, trim: true, maxlength: 1000 },
    readAt: { type: Date, default: null },
    emailSubject: { type: String, required: true, maxlength: 200 },
    emailStatus: { type: String, enum: ["pending", "sending", "sent", "failed"], default: "pending" },
    emailAttempts: { type: Number, default: 0, min: 0 },
    nextEmailAttemptAt: { type: Date, default: null },
    emailError: { type: String, default: "", maxlength: 1000 },
  },
  { timestamps: true },
);

customerNotificationSchema.index({ user: 1, createdAt: -1 });
customerNotificationSchema.index({ emailStatus: 1, nextEmailAttemptAt: 1 });

const CustomerNotification = mongoose.model("CustomerNotification", customerNotificationSchema);
export default CustomerNotification;
