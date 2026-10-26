
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
  requestEmailChange,
  confirmEmailChange,
  deleteMyAccount,
} from "../controllers/user.controller.js";

import { authorizePermission, requireAuth } from "../middlewares/auth.middleware.js";
import { PERMISSIONS } from "../config/admin-permissions.js";
import { getMyNotifications, markMyNotificationRead } from "../controllers/customerNotification.controller.js";
import { authRateLimit } from "../middlewares/authRateLimit.middleware.js";
import { exportMyData } from "../controllers/storefront.controller.js";

const router = express.Router();

// Customer profile
router.get("/me", requireAuth, getMyProfile);
router.get("/me/export", requireAuth, exportMyData);
router.patch("/me", requireAuth, updateMyProfile);
router.post("/me/email-change", requireAuth, authRateLimit({ name: "email-change", limit: 4, windowMs: 60 * 60 * 1000, identityField: "email" }), requestEmailChange);
router.post("/me/email-change/confirm", requireAuth, authRateLimit({ name: "email-change-confirm", limit: 8, windowMs: 15 * 60 * 1000 }), confirmEmailChange);
router.delete("/me", requireAuth, authRateLimit({ name: "account-close", limit: 5, windowMs: 15 * 60 * 1000 }), deleteMyAccount);
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
