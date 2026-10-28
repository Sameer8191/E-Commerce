import mongoose from "mongoose";
import "dotenv/config";

let connectionPromise;

export const connectDB = async () => {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (mongoose.connection.readyState === 0) connectionPromise = undefined;
  if (connectionPromise) return connectionPromise;

  connectionPromise = (async () => {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) throw new Error("MONGO_URI is required");

    const conn = await mongoose.connect(mongoUri);
    // Checkout and cancellation rely on multi-document transactions.
    const topology = await conn.connection.db.admin().command({ hello: 1 });
    if (!topology.setName && topology.msg !== "isdbgrid") {
      await mongoose.disconnect();
      throw new Error("MongoDB transactions require a replica set or sharded cluster");
    }

    console.log("MongoDB Connected", conn.connection.host);
    return conn.connection;
  })();

  try {
    return await connectionPromise;
  } catch (error) {
    console.error("MongoDB connection failed", error.message);
    connectionPromise = undefined;
    throw error;
  }
};
