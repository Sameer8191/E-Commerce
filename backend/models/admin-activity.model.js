import mongoose from "mongoose";

const adminActivitySchema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  action: { type: String, required: true, maxlength: 80 },
  entityType: { type: String, required: true, maxlength: 40 },
  entityId: { type: String, default: "", maxlength: 100 },
  summary: { type: String, required: true, maxlength: 300 },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

adminActivitySchema.index({ createdAt: -1 });

export default mongoose.model("AdminActivity", adminActivitySchema);
