
import express from "express";
import {
  createRazorpayOrder,
  verifyRazorpayPayment,
} from "../controllers/payment.controller.js";
import { razorpayWebhook } from "../controllers/paymentWebhook.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/webhook", razorpayWebhook);
router.post("/create-order", requireAuth, createRazorpayOrder);
router.post("/verify", requireAuth, verifyRazorpayPayment);

export default router;
