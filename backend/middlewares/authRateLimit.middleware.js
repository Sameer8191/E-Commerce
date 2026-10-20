import crypto from "node:crypto";
import RateLimit from "../models/rate-limit.model.js";

// MongoDB-backed so limits are shared by every application instance.
export const authRateLimit = ({ name, limit, windowMs }) => async (req, res, next) => {
  const now = new Date();
  const source = `${name}:${req.ip || req.socket.remoteAddress || "unknown"}`;
  const key = crypto.createHash("sha256").update(source).digest("hex");
  const resetAt = new Date(now.getTime() + windowMs);

  try {
    const doc = await RateLimit.findOneAndUpdate(
      { key },
      [{ $set: {
        count: { $cond: [{ $lte: ["$resetAt", now] }, 1, { $add: [{ $ifNull: ["$count", 0] }, 1] }] },
        resetAt: { $cond: [{ $lte: ["$resetAt", now] }, resetAt, { $ifNull: ["$resetAt", resetAt] }] },
      } }],
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true, updatePipeline: true },
    ).lean();

    res.set("RateLimit-Limit", String(limit));
    res.set("RateLimit-Remaining", String(Math.max(0, limit - doc.count)));
    res.set("RateLimit-Reset", String(Math.ceil(doc.resetAt.getTime() / 1000)));
    if (doc.count > limit) {
      return res.status(429).json({ success: false, message: "Too many attempts. Try again later." });
    }
    return next();
  } catch (error) {
    // Fail closed for credential and OTP endpoints if the limiter cannot be checked.
    console.error("Authentication rate limit check failed:", error.message);
    return res.status(503).json({ success: false, message: "Authentication service temporarily unavailable" });
  }
};
