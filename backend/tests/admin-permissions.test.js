import test from "node:test";
import assert from "node:assert/strict";
import {
  getPermissionsForRole,
  hasPermission,
  PERMISSIONS,
} from "../config/admin-permissions.js";
import { authorizePermission } from "../middlewares/auth.middleware.js";

const runAuthorization = (role, permission) => {
  let statusCode;
  let responseBody;
  let nextCalled = false;
  const response = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(body) {
      responseBody = body;
      return this;
    },
  };
  authorizePermission(permission)(
    { user: { role } },
    response,
    () => { nextCalled = true; },
  );
  return { statusCode, responseBody, nextCalled };
};

test("unknown roles receive no permissions", () => {
  assert.deepEqual(getPermissionsForRole("unknown"), []);
  assert.deepEqual(getPermissionsForRole("customer"), []);
});

test("admin retains full access while operational roles are least-privilege", () => {
  assert.deepEqual(new Set(getPermissionsForRole("admin")), new Set(Object.values(PERMISSIONS)));
  assert.equal(hasPermission("support", PERMISSIONS.RETURNS_REJECT), true);
  assert.equal(hasPermission("support", PERMISSIONS.REFUNDS_APPROVE), false);
  assert.equal(hasPermission("fulfillment", PERMISSIONS.ORDERS_UPDATE_FULFILLMENT), true);
  assert.equal(hasPermission("fulfillment", PERMISSIONS.ORDERS_CANCEL), false);
  assert.equal(hasPermission("inventory_manager", PERMISSIONS.INVENTORY_ADJUST), true);
  assert.equal(hasPermission("inventory_manager", PERMISSIONS.CATALOG_MANAGE), false);
  assert.equal(hasPermission("finance_manager", PERMISSIONS.REFUNDS_APPROVE), true);
  assert.equal(hasPermission("finance_manager", PERMISSIONS.SALES_TARGET_UPDATE), false);
  assert.equal(hasPermission("finance_manager", PERMISSIONS.VENDOR_SETTLE), true);
  assert.equal(hasPermission("finance_manager", PERMISSIONS.VENDORS_MANAGE), false);
  assert.equal(hasPermission("vendor", PERMISSIONS.VENDOR_PORTAL_ACCESS), true);
  assert.equal(hasPermission("vendor", PERMISSIONS.ORDERS_READ), false);
  assert.equal(hasPermission("vendor", PERMISSIONS.REFUNDS_APPROVE), false);
});

test("permission middleware allows authorized staff", () => {
  const result = runAuthorization("fulfillment", PERMISSIONS.ORDERS_UPDATE_FULFILLMENT);
  assert.equal(result.nextCalled, true);
  assert.equal(result.statusCode, undefined);
});

test("permission middleware denies staff without the requested permission", () => {
  const result = runAuthorization("support", PERMISSIONS.CUSTOMERS_DEACTIVATE);
  assert.equal(result.nextCalled, false);
  assert.equal(result.statusCode, 403);
  assert.equal(result.responseBody.code, "INSUFFICIENT_PERMISSION");
});

test("vendor accounts cannot use staff order or refund permissions", () => {
  const orderResult = runAuthorization("vendor", PERMISSIONS.ORDERS_READ);
  const refundResult = runAuthorization("vendor", PERMISSIONS.REFUNDS_APPROVE);
  assert.equal(orderResult.statusCode, 403);
  assert.equal(refundResult.statusCode, 403);
});

test("coupon management is restricted to the store owner", () => {
  assert.equal(hasPermission("admin", PERMISSIONS.COUPONS_MANAGE), true);
  assert.equal(hasPermission("finance_manager", PERMISSIONS.COUPONS_MANAGE), false);
  assert.equal(hasPermission("support", PERMISSIONS.COUPONS_MANAGE), false);
  assert.equal(runAuthorization("finance_manager", PERMISSIONS.COUPONS_MANAGE).statusCode, 403);
});
