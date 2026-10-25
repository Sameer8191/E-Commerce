import express from "express";
import { validateCartCoupon } from "../controllers/coupon.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const router = express.Router();
router.post("/validate", requireAuth, validateCartCoupon);

export default router;
