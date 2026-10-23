import express from "express";

import {
  getAdminDashboard,
  getAdminCatalogInsights,
  getAdminInventory,
  adjustAdminInventory,
  createAdminCategory,
  bulkCreateAdminProducts,
  getAdminOrders,
  updateAdminOrderStatus,
  updateUserStatus,
} from "../controllers/admin.controller.js";
import {
  deleteUser,
  getAllUsers,
  getUserById,
  updateUserRole,
} from "../controllers/user.controller.js";
import { authorize, requireAuth } from "../middlewares/auth.middleware.js";

const adminRoutes = express.Router();

// Every endpoint under /api/admin requires an authenticated admin.
adminRoutes.use(requireAuth, authorize("admin"));

adminRoutes.get("/dashboard", getAdminDashboard);
adminRoutes.get("/catalog/insights", getAdminCatalogInsights);
adminRoutes.get("/inventory", getAdminInventory);
adminRoutes.patch("/inventory/:productId", adjustAdminInventory);
adminRoutes.post("/catalog/categories", createAdminCategory);
adminRoutes.post("/catalog/products/bulk", bulkCreateAdminProducts);
adminRoutes.get("/orders", getAdminOrders);
adminRoutes.patch("/orders/:orderId/status", updateAdminOrderStatus);
adminRoutes.get("/users", getAllUsers);
adminRoutes.get("/users/:id", getUserById);
adminRoutes.patch("/users/:id/role", updateUserRole);
adminRoutes.patch("/users/:id/status", updateUserStatus);
adminRoutes.delete("/users/:id", deleteUser);

export default adminRoutes;
