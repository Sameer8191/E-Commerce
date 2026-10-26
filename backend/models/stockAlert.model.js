import mongoose from "mongoose";

const schema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  notifiedAt: { type: Date, default: null },
}, { timestamps: true });
schema.index({ product: 1, email: 1 }, { unique: true });

export default mongoose.model("StockAlert", schema);
