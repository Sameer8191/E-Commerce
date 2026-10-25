import mongoose from "mongoose";

const cloudinaryCleanupSchema = new mongoose.Schema(
  {
    publicId: { type: String, required: true, unique: true, trim: true },
    attempts: { type: Number, required: true, default: 0, min: 0 },
    nextAttemptAt: { type: Date, required: true, default: Date.now },
    lockedUntil: { type: Date, default: null },
    lastError: { type: String, default: null, maxlength: 1000 },
  },
  { timestamps: true },
);

cloudinaryCleanupSchema.index({ nextAttemptAt: 1, lockedUntil: 1 });

export default mongoose.model("CloudinaryCleanup", cloudinaryCleanupSchema);
