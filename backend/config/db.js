import mongoose from "mongoose";
import "dotenv/config";

export const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;

    if (!mongoUri) {
      throw new Error("MONGO_URI is required");
    }

    const conn = await mongoose.connect(mongoUri);

    console.log("MongoDB Connected", conn.connection.host);
  } catch (error) {
    console.error("MongoDB connection failed", error.message);
    process.exit(1);
    // 1 means failed, 0 means success
  }
};
