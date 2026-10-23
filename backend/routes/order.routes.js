import express from "express";
import {
  cancelOrder,
  getMyOrders,
  getOrderById,
} from "../controllers/order.controller.js";
import { createOrder } from "../controllers/orderCheckout.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const orderRouter = express.Router();

orderRouter.use(requireAuth);
orderRouter.post("/", createOrder);
orderRouter.get("/", getMyOrders);
orderRouter.get("/:orderId", getOrderById);
orderRouter.patch("/:orderId/cancel", cancelOrder);

export default orderRouter;
