import mongoose from "mongoose";

const adminSettingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, default: "store" },
  monthlySalesTarget: { type: Number, required: true, min: 1, default: 100000 },
  marketplaceCommissionRate: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
    default: 10,
  },
}, { timestamps: true });

export default mongoose.model("AdminSetting", adminSettingSchema);
