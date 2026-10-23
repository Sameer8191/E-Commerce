import crypto from "node:crypto";
import RateLimit from "../models/rate-limit.model.js";

// MongoDB-backed so limits are shared by every application instance.
export const authRateLimit = ({ name, limit, windowMs, identityField }) => async (req, res, next) => {
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowMs);
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const identities = [`ip:${name}:${ip}`];
  const identity = req.body?.[identityField];

  if (identityField && typeof identity === "string" && identity.trim()) {
    identities.push(`account:${name}:${identity.trim().toLowerCase()}`);
  }

  try {
    let ipLimitDoc;
    for (const source of identities) {
      const key = crypto.createHash("sha256").update(source).digest("hex");
      const doc = await RateLimit.findOneAndUpdate(
        { key },
        [{ $set: {
          count: { $cond: [{ $lte: ["$resetAt", now] }, 1, { $add: [{ $ifNull: ["$count", 0] }, 1] }] },
          resetAt: { $cond: [{ $lte: ["$resetAt", now] }, resetAt, { $ifNull: ["$resetAt", resetAt] }] },
        } }],
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true, updatePipeline: true },
      ).lean();

      if (source.startsWith("ip:")) ipLimitDoc = doc;
      if (doc.count > limit) {
        if (ipLimitDoc) {
          res.set("RateLimit-Limit", String(limit));
          res.set("RateLimit-Remaining", String(Math.max(0, limit - ipLimitDoc.count)));
          res.set("RateLimit-Reset", String(Math.ceil(ipLimitDoc.resetAt.getTime() / 1000)));
        }
        return res.status(429).json({ success: false, message: "Too many attempts. Try again later." });
      }
    }

    res.set("RateLimit-Limit", String(limit));
    res.set("RateLimit-Remaining", String(Math.max(0, limit - ipLimitDoc.count)));
    res.set("RateLimit-Reset", String(Math.ceil(ipLimitDoc.resetAt.getTime() / 1000)));
    return next();
  } catch (error) {
    // Fail closed for credential and OTP endpoints if the limiter cannot be checked.
    console.error("Authentication rate limit check failed:", error.message);
    return res.status(503).json({ success: false, message: "Authentication service temporarily unavailable" });
  }
};
