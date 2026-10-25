import express from "express";

import {
  getAdminDashboard,
  getAdminCatalogInsights,
  getAdminInventory,
  adjustAdminInventory,
  createAdminCategory,
  bulkCreateAdminProducts,
  getAdminOrders,
  getAdminOrderById,
  updateAdminOrderStatus,
  cancelAdminOrder,
  updateUserStatus,
  getAdminSettings,
  updateMonthlySalesTarget,
  getAdminActivity,
  getAdminReturns,
  reviewAdminReturn,
  getAdminNotifications,
  markAdminNotificationRead,
} from "../controllers/admin.controller.js";
import {
  deleteUser,
  getAdminStaff,
  getAllUsers,
  getUserById,
  updateUserRole,
} from "../controllers/user.controller.js";
import { authorizePermission, requireAuth } from "../middlewares/auth.middleware.js";
import { uploadBulkProductImport } from "../middlewares/upload.middleware.js";
import { PERMISSIONS, hasPermission } from "../config/admin-permissions.js";
import {
  createPlatformVendorAndMigrate,
  getAdminMarketplaceSettlements,
  getAdminMarketplaceSettings,
  getAdminVendors,
  recordAdminVendorSettlement,
  reviewAdminVendor,
  updateAdminMarketplaceCommission,
} from "../controllers/vendor.controller.js";
import { createCoupon, getCoupons, setCouponActive } from "../controllers/coupon.controller.js";

const adminRoutes = express.Router();

adminRoutes.use(requireAuth);
adminRoutes.get("/coupons", authorizePermission(PERMISSIONS.COUPONS_MANAGE), getCoupons);
adminRoutes.post("/coupons", authorizePermission(PERMISSIONS.COUPONS_MANAGE), createCoupon);
adminRoutes.patch("/coupons/:couponId", authorizePermission(PERMISSIONS.COUPONS_MANAGE), setCouponActive);

const authorizeReturnAction = (req, res, next) => {
  const permissionByAction = {
    approve: PERMISSIONS.REFUNDS_APPROVE,
    reject: PERMISSIONS.RETURNS_REJECT,
    retry_refund: PERMISSIONS.REFUNDS_RETRY,
    mark_refunded: PERMISSIONS.REFUNDS_RECORD_MANUAL,
  };
  const permission = permissionByAction[req.body?.action];
  if (!permission) return next();
  if (!hasPermission(req.user.role, permission)) {
    return res.status(403).json({
      success: false,
      code: "INSUFFICIENT_PERMISSION",
      message: "Your staff role cannot perform this return or refund action.",
    });
  }
  return next();
};

const authorizeDashboardView = (req, res, next) => {
  const permission = req.query.days === undefined
    ? PERMISSIONS.DASHBOARD_READ
    : PERMISSIONS.ANALYTICS_READ;
  if (!hasPermission(req.user.role, permission)) {
    return res.status(403).json({
      success: false,
      code: "INSUFFICIENT_PERMISSION",
      message: "Your staff role cannot access this dashboard view.",
    });
  }
  return next();
};

const notificationPermissions = [
  PERMISSIONS.INVENTORY_READ,
  PERMISSIONS.RETURNS_READ,
];

adminRoutes.get("/dashboard", authorizeDashboardView, getAdminDashboard);
adminRoutes.get("/marketplace/vendors", authorizePermission(PERMISSIONS.VENDORS_MANAGE), getAdminVendors);
adminRoutes.patch("/marketplace/vendors/:vendorId", authorizePermission(PERMISSIONS.VENDORS_MANAGE), reviewAdminVendor);
adminRoutes.post("/marketplace/platform-store", authorizePermission(PERMISSIONS.VENDORS_MANAGE), createPlatformVendorAndMigrate);
adminRoutes.get("/marketplace/settings", authorizePermission(PERMISSIONS.VENDORS_MANAGE), getAdminMarketplaceSettings);
adminRoutes.patch("/marketplace/settings/commission", authorizePermission(PERMISSIONS.VENDORS_MANAGE), updateAdminMarketplaceCommission);
adminRoutes.get("/marketplace/settlements", authorizePermission(PERMISSIONS.VENDOR_SETTLE), getAdminMarketplaceSettlements);
adminRoutes.post("/marketplace/settlements", authorizePermission(PERMISSIONS.VENDOR_SETTLE), recordAdminVendorSettlement);
adminRoutes.get("/settings", authorizePermission(PERMISSIONS.SALES_TARGET_READ), getAdminSettings);
adminRoutes.patch("/settings/monthly-target", authorizePermission(PERMISSIONS.SALES_TARGET_UPDATE), updateMonthlySalesTarget);
adminRoutes.get("/activity", authorizePermission(PERMISSIONS.ACTIVITY_READ), getAdminActivity);
adminRoutes.get("/notifications", authorizePermission(...notificationPermissions), getAdminNotifications);
adminRoutes.patch("/notifications/:notificationId/read", authorizePermission(...notificationPermissions), markAdminNotificationRead);
adminRoutes.get("/catalog/insights", authorizePermission(PERMISSIONS.CATALOG_READ, PERMISSIONS.INVENTORY_READ), getAdminCatalogInsights);
adminRoutes.get("/inventory", authorizePermission(PERMISSIONS.INVENTORY_READ), getAdminInventory);
adminRoutes.patch("/inventory/:productId", authorizePermission(PERMISSIONS.INVENTORY_ADJUST), adjustAdminInventory);
adminRoutes.post("/catalog/categories", authorizePermission(PERMISSIONS.CATALOG_MANAGE), createAdminCategory);
adminRoutes.post("/catalog/products/bulk", authorizePermission(PERMISSIONS.CATALOG_MANAGE), uploadBulkProductImport, bulkCreateAdminProducts);
adminRoutes.get("/orders", authorizePermission(PERMISSIONS.ORDERS_READ), getAdminOrders);
adminRoutes.get("/reports/orders", authorizePermission(PERMISSIONS.REPORTS_EXPORT), getAdminOrders);
adminRoutes.get("/returns", authorizePermission(PERMISSIONS.RETURNS_READ), getAdminReturns);
adminRoutes.patch("/returns/:orderId", authorizePermission(
  PERMISSIONS.RETURNS_REJECT,
  PERMISSIONS.REFUNDS_APPROVE,
  PERMISSIONS.REFUNDS_RETRY,
  PERMISSIONS.REFUNDS_RECORD_MANUAL,
), authorizeReturnAction, reviewAdminReturn);
adminRoutes.get("/orders/:orderId", authorizePermission(PERMISSIONS.ORDERS_READ), getAdminOrderById);
adminRoutes.patch("/orders/:orderId/cancel", authorizePermission(PERMISSIONS.ORDERS_CANCEL), cancelAdminOrder);
adminRoutes.patch("/orders/:orderId/status", authorizePermission(PERMISSIONS.ORDERS_UPDATE_FULFILLMENT), updateAdminOrderStatus);
adminRoutes.get("/users", authorizePermission(PERMISSIONS.CUSTOMERS_READ), getAllUsers);
adminRoutes.get("/users/staff", authorizePermission(PERMISSIONS.STAFF_MANAGE), getAdminStaff);
adminRoutes.get("/users/:id", authorizePermission(PERMISSIONS.CUSTOMERS_READ), getUserById);
adminRoutes.patch("/users/:id/role", authorizePermission(PERMISSIONS.STAFF_MANAGE), updateUserRole);
adminRoutes.patch("/users/:id/status", authorizePermission(PERMISSIONS.CUSTOMERS_DEACTIVATE), updateUserStatus);
adminRoutes.delete("/users/:id", authorizePermission(PERMISSIONS.CUSTOMERS_DEACTIVATE), deleteUser);

export default adminRoutes;
