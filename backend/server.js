import dns from "node:dns/promises";
dns.setServers(["1.1.1.1", "8.8.8.8"]);

import express from "express";
import cors from "cors";
import multer from "multer";
import "dotenv/config";
import cron from "node-cron";

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

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await connectDB();

    // Release expired Razorpay inventory reservations every 5 minutes.
    cron.schedule("*/5 * * * *", async () => {
      try {
        const result = await releaseExpiredOrderReservations();
        console.log("Expired reservation job:", result);
      } catch (error) {
        console.error("Expired reservation job failed:", error);
      }
    });

    cron.schedule("*/5 * * * *", async () => {
      try {
        const result = await retryPendingStockAlerts();
        if (result.sent) console.log("Back-in-stock emails sent:", result);
      } catch (error) {
        console.error("Back-in-stock alert retry failed:", error);
      }
    });

    cron.schedule("*/5 * * * *", async () => {
      try {
        const result = await retryCustomerNotificationEmails();
        if (result.examined) console.log("Customer email retry job:", result);
      } catch (error) {
        console.error("Customer email retry job failed:", error);
      }
    });

    // Reconcile persisted refunds after transient Razorpay/API failures.
    cron.schedule("* * * * *", async () => {
      try {
        const result = await reconcilePendingRefunds();
        if (result.claimed) console.log("Refund reconciliation:", result);
      } catch (error) {
        console.error("Refund reconciliation job failed:", error);
      }
    });

    // Retry failed Cloudinary image deletions without blocking product updates.
    cron.schedule("*/5 * * * *", async () => {
      try {
        const result = await retryCloudinaryCleanup();
        if (result.examined) console.log("Cloudinary cleanup retry:", result);
      } catch (error) {
        console.error("Cloudinary cleanup retry job failed:", error);
      }
    });

    app.listen(PORT, () => {
      console.log(`Server is running at http://localhost:${PORT}/`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
