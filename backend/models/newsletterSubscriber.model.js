import mongoose from "mongoose";

const schema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true, trim: true, unique: true, match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
  consentedAt: { type: Date, default: Date.now, required: true },
}, { timestamps: true });

export default mongoose.model("NewsletterSubscriber", schema);
