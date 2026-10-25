import mongoose from "mongoose";

const visitorSchema = new mongoose.Schema({
  visitorId: { type: String, required: true, unique: true, maxlength: 64 },
  visitedAt: { type: Date, default: Date.now, required: true },
});

visitorSchema.index({ visitedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 180 });

export default mongoose.model("Visitor", visitorSchema);
