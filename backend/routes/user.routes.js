
import express from "express";

import {
  getMyProfile,
  updateMyProfile,
  getAllUsers,
  getAdminStaff,
  getUserById,
  updateUserRole,
  deleteUser,
  addMyAddress,
  updateMyAddress,
  deleteMyAddress,
} from "../controllers/user.controller.js";

import { authorizePermission, requireAuth } from "../middlewares/auth.middleware.js";
import { PERMISSIONS } from "../config/admin-permissions.js";
import { getMyNotifications, markMyNotificationRead } from "../controllers/customerNotification.controller.js";

const router = express.Router();

// Customer profile
router.get("/me", requireAuth, getMyProfile);
router.patch("/me", requireAuth, updateMyProfile);
router.post("/me/addresses", requireAuth, addMyAddress);
router.patch("/me/addresses/:addressId", requireAuth, updateMyAddress);
router.delete("/me/addresses/:addressId", requireAuth, deleteMyAddress);
router.get("/me/notifications", requireAuth, getMyNotifications);
router.patch("/me/notifications/:notificationId/read", requireAuth, markMyNotificationRead);

// Admin user management
router.get("/", requireAuth, authorizePermission(PERMISSIONS.CUSTOMERS_READ), getAllUsers);
router.get("/staff", requireAuth, authorizePermission(PERMISSIONS.STAFF_MANAGE), getAdminStaff);
router.get("/:id", requireAuth, authorizePermission(PERMISSIONS.CUSTOMERS_READ), getUserById);
router.patch("/:id/role", requireAuth, authorizePermission(PERMISSIONS.STAFF_MANAGE), updateUserRole);
router.delete("/:id", requireAuth, authorizePermission(PERMISSIONS.CUSTOMERS_DEACTIVATE), deleteUser);

export default router;
