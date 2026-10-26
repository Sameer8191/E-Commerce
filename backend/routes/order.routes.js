import express from "express";
import {
  cancelOrder,
  createReturnRequest,
  getMyOrders,
  getOrderById,
  lookupOrderByNumber,
} from "../controllers/order.controller.js";
import { createOrder } from "../controllers/orderCheckout.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { authRateLimit } from "../middlewares/authRateLimit.middleware.js";

const orderRouter = express.Router();

orderRouter.post("/lookup", authRateLimit({ name: "order-lookup", limit: 8, windowMs: 15 * 60 * 1000, identityField: "email" }), lookupOrderByNumber);
orderRouter.use(requireAuth);
orderRouter.post("/", createOrder);
orderRouter.get("/", getMyOrders);
orderRouter.get("/:orderId", getOrderById);
orderRouter.patch("/:orderId/cancel", cancelOrder);
orderRouter.post("/:orderId/return-request", createReturnRequest);

export default orderRouter;
