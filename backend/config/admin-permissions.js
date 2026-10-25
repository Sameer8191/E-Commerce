export const STAFF_ROLES = [
  "admin",
  "support",
  "fulfillment",
  "inventory_manager",
  "finance_manager",
];

export const USER_ROLES = ["customer", "vendor", ...STAFF_ROLES];

export const PERMISSIONS = {
  DASHBOARD_READ: "dashboard.read",
  ANALYTICS_READ: "analytics.read",
  ORDERS_READ: "orders.read",
  ORDERS_UPDATE_FULFILLMENT: "orders.update_fulfillment",
  ORDERS_CANCEL: "orders.cancel",
  INVOICES_READ: "invoices.read",
  CUSTOMERS_READ: "customers.read",
  CUSTOMERS_DEACTIVATE: "customers.deactivate",
  INVENTORY_READ: "inventory.read",
  INVENTORY_ADJUST: "inventory.adjust",
  CATALOG_READ: "catalog.read",
  CATALOG_MANAGE: "catalog.manage",
  RETURNS_READ: "returns.read",
  RETURNS_REJECT: "returns.reject",
  REFUNDS_APPROVE: "refunds.approve",
  REFUNDS_RETRY: "refunds.retry",
  REFUNDS_RECORD_MANUAL: "refunds.record_manual",
  REPORTS_EXPORT: "reports.export",
  ACTIVITY_READ: "activity.read",
  SALES_TARGET_READ: "sales_target.read",
  SALES_TARGET_UPDATE: "sales_target.update",
  STAFF_MANAGE: "staff.manage",
  VENDOR_PORTAL_ACCESS: "vendor.portal_access",
  VENDORS_MANAGE: "vendors.manage",
  VENDOR_SETTLE: "vendors.settle",
  COUPONS_MANAGE: "coupons.manage",
};

const allPermissions = Object.values(PERMISSIONS);

export const ROLE_PERMISSIONS = Object.freeze({
  admin: allPermissions,
  support: [
    PERMISSIONS.ORDERS_READ,
    PERMISSIONS.INVOICES_READ,
    PERMISSIONS.CUSTOMERS_READ,
    PERMISSIONS.RETURNS_READ,
    PERMISSIONS.RETURNS_REJECT,
  ],
  fulfillment: [
    PERMISSIONS.ORDERS_READ,
    PERMISSIONS.ORDERS_UPDATE_FULFILLMENT,
    PERMISSIONS.INVENTORY_READ,
  ],
  inventory_manager: [
    PERMISSIONS.INVENTORY_READ,
    PERMISSIONS.INVENTORY_ADJUST,
    PERMISSIONS.CATALOG_READ,
  ],
  finance_manager: [
    PERMISSIONS.DASHBOARD_READ,
    PERMISSIONS.ANALYTICS_READ,
    PERMISSIONS.ORDERS_READ,
    PERMISSIONS.INVOICES_READ,
    PERMISSIONS.RETURNS_READ,
    PERMISSIONS.RETURNS_REJECT,
    PERMISSIONS.REFUNDS_APPROVE,
    PERMISSIONS.REFUNDS_RETRY,
    PERMISSIONS.REFUNDS_RECORD_MANUAL,
    PERMISSIONS.REPORTS_EXPORT,
    PERMISSIONS.ACTIVITY_READ,
    PERMISSIONS.SALES_TARGET_READ,
    PERMISSIONS.VENDOR_SETTLE,
  ],
  vendor: [PERMISSIONS.VENDOR_PORTAL_ACCESS],
});

export const getPermissionsForRole = (role) => ROLE_PERMISSIONS[role] || [];

export const hasPermission = (role, permission) =>
  getPermissionsForRole(role).includes(permission);

export const hasAnyPermission = (role, permissions) =>
  permissions.some((permission) => hasPermission(role, permission));
