import express from "express";
import { createStockAlert, sendContactMessage, subscribeNewsletter, unsubscribeNewsletter } from "../controllers/storefront.controller.js";
import { authRateLimit } from "../middlewares/authRateLimit.middleware.js";

const router = express.Router();
router.post("/newsletter", authRateLimit({ name: "newsletter-subscribe", limit: 5, windowMs: 15 * 60 * 1000, identityField: "email" }), subscribeNewsletter);
router.post("/contact", authRateLimit({ name: "customer-contact", limit: 5, windowMs: 60 * 60 * 1000, identityField: "email" }), sendContactMessage);
router.post("/newsletter/unsubscribe", authRateLimit({ name: "newsletter-unsubscribe", limit: 10, windowMs: 15 * 60 * 1000, identityField: "email" }), unsubscribeNewsletter);
router.post("/products/:productId/stock-alert", authRateLimit({ name: "stock-alert", limit: 5, windowMs: 60 * 60 * 1000, identityField: "email" }), createStockAlert);
export default router;
