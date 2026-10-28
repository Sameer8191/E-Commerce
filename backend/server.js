import dns from "node:dns/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
dns.setServers(["1.1.1.1", "8.8.8.8"]);

import express from "express";
import cors from "cors";
import multer from "multer";
import "dotenv/config";

import authRoutes from "./routes/auth.routes.js";
import productRoutes from "./routes/product.routes.js";
import categoryRoutes from "./routes/category.routes.js";
import orderRoutes from "./routes/order.routes.js";
import cartRoutes from "./routes/cart.routes.js";
import paymentRoutes from "./routes/payment.routes.js";
import userRoutes from "./routes/user.routes.js";
import reviewRoutes from "./routes/review.routes.js";
import wishlistRoutes from "./routes/wishlist.routes.js";
import couponRoutes from "./routes/coupon.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import vendorRoutes from "./routes/vendor.routes.js";
import storefrontRoutes from "./routes/storefront.routes.js";
import { recordVisitor } from "./controllers/visitor.controller.js";

import { connectDB } from "./config/db.js";
import { releaseExpiredOrderReservations } from "./jobs/releaseExpiredOrderReservations.js";
import { reconcilePendingRefunds } from "./jobs/reconcilePendingRefunds.js";
import { retryCloudinaryCleanup } from "./jobs/retryCloudinaryCleanup.js";
import { retryCustomerNotificationEmails } from "./services/customerNotificationService.js";
import { retryPendingStockAlerts } from "./controllers/storefront.controller.js";

const app = express();
app.disable("x-powered-by");

const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);
if (!Number.isInteger(trustProxyHops) || trustProxyHops < 0) {
  throw new Error("TRUST_PROXY_HOPS must be a non-negative integer");
}
if (trustProxyHops > 0) app.set("trust proxy", trustProxyHops);

// Configure the browser origins explicitly; non-browser clients have no Origin header.
if (process.env.NODE_ENV === "production" && !process.env.CORS_ORIGINS?.trim()) {
  throw new Error("CORS_ORIGINS must be configured in production");
}
if (process.env.NODE_ENV === "production" && Buffer.byteLength(process.env.JWT_SECRET || "") < 32) {
  throw new Error("JWT_SECRET must be configured with at least 32 bytes in production");
}
if (process.env.NODE_ENV === "production" && process.env.OTP_HMAC_SECRET && Buffer.byteLength(process.env.OTP_HMAC_SECRET) < 32) {
  throw new Error("OTP_HMAC_SECRET must contain at least 32 bytes in production");
}

const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Origin is not allowed by CORS"));
  },
}));
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    next(error);
  }
});
app.use(express.json({
  limit: "1mb",
  verify: (req, res, buffer) => {
    if (req.originalUrl.startsWith("/api/payments/webhook")) {
      req.rawBody = Buffer.from(buffer);
    }
  },
}));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/category", categoryRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/users", userRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/coupons", couponRoutes);
app.post("/api/analytics/visit", express.json(), recordVisitor);
app.use("/api/admin", adminRoutes);
app.use("/api/vendors", vendorRoutes);
app.use("/api/storefront", storefrontRoutes);

const cronAuthorized = (req) => {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && req.get("authorization") === `Bearer ${secret}`;
};

app.get("/api/cron/minute", async (req, res, next) => {
  if (!cronAuthorized(req)) return res.status(401).json({ success: false, message: "Unauthorized" });
  try {
    const refunds = await reconcilePendingRefunds();
    return res.json({ success: true, refunds });
  } catch (error) {
    return next(error);
  }
});

app.get("/api/cron/five-minutes", async (req, res, next) => {
  if (!cronAuthorized(req)) return res.status(401).json({ success: false, message: "Unauthorized" });
  try {
    const [reservations, stockAlerts, customerEmails, cloudinaryCleanup] = await Promise.all([
      releaseExpiredOrderReservations(),
      retryPendingStockAlerts(),
      retryCustomerNotificationEmails(),
      retryCloudinaryCleanup(),
    ]);
    return res.json({ success: true, reservations, stockAlerts, customerEmails, cloudinaryCleanup });
  } catch (error) {
    return next(error);
  }
});

// Test route
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "E-commerce API is running",
  });
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error instanceof multer.MulterError) {
    const status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    const message = error.code === "LIMIT_FILE_SIZE"
      ? "Uploaded file exceeds the 5 MB limit"
      : "Uploaded files or form fields exceed the allowed limits";
    return res.status(status).json({ success: false, message });
  }
  const status = error.statusCode || error.status || 500;
  if (status >= 500) console.error("Unhandled request error:", error);
  return res.status(status).json({
    success: false,
    message: status >= 500 ? "Internal server error" : error.message,
  });
});

export default app;

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}/`);
  });
}
