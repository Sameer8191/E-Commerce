import test from "node:test";
import assert from "node:assert/strict";
import { calculateCouponDiscount, normalizeCouponCode } from "../utils/coupon.utils.js";
import { fingerprintCheckout, isSupportedShippingAddress, validAddress } from "../utils/order.utils.js";

const now = new Date("2026-10-24T12:00:00.000Z");
const coupon = {
  isActive: true,
  discountType: "percentage",
  discountValue: 10,
  minimumSubtotal: 0,
  maximumDiscount: null,
  usageLimit: null,
  usageCount: 0,
  startsAt: null,
  expiresAt: null,
};

test("percentage coupons calculate a rounded discount in paise", () => {
  assert.deepEqual(calculateCouponDiscount(coupon, 10_001, now), {
    valid: true,
    discountPaise: 1_000,
  });
});

test("fixed discounts respect the subtotal and optional maximum", () => {
  assert.equal(calculateCouponDiscount({
    ...coupon,
    discountType: "fixed",
    discountValue: 80,
    maximumDiscount: 25,
  }, 10_000, now).discountPaise, 2_500);
  assert.equal(calculateCouponDiscount({
    ...coupon,
    discountType: "fixed",
    discountValue: 80,
    maximumDiscount: null,
  }, 5_000, now).discountPaise, 5_000);
});

test("coupon eligibility enforces activity, dates, minimum spend, and usage limit", () => {
  assert.equal(calculateCouponDiscount({ ...coupon, isActive: false }, 10_000, now).valid, false);
  assert.equal(calculateCouponDiscount({ ...coupon, startsAt: new Date(now.getTime() + 1) }, 10_000, now).message, "This coupon is not active yet.");
  assert.equal(calculateCouponDiscount({ ...coupon, expiresAt: new Date(now.getTime() - 1) }, 10_000, now).message, "This coupon has expired.");
  assert.equal(calculateCouponDiscount({ ...coupon, minimumSubtotal: 100 }, 9_999, now).valid, false);
  assert.equal(calculateCouponDiscount({ ...coupon, usageLimit: 5, usageCount: 5 }, 10_000, now).message, "This coupon has reached its usage limit.");
});

test("coupon codes normalize consistently and are part of checkout idempotency", () => {
  assert.equal(normalizeCouponCode("  good-10 "), "GOOD-10");
  const shippingAddress = {
    fullName: "Buyer",
    phone: "1234567890",
    addressLine1: "1 Main Street",
    addressLine2: "",
    city: "Mumbai",
    state: "Maharashtra",
    postalCode: "400001",
    country: "India",
  };
  const initial = fingerprintCheckout({ shippingAddress, paymentMethod: "cod", couponCode: "GOOD10" });
  assert.equal(initial, fingerprintCheckout({ shippingAddress, paymentMethod: "cod", couponCode: "GOOD10" }));
  assert.notEqual(initial, fingerprintCheckout({ shippingAddress, paymentMethod: "cod", couponCode: "GOOD20" }));
});

test("shipping accepts valid India addresses and rejects other countries", () => {
  const address = {
    fullName: "Buyer",
    phone: "1234567890",
    addressLine1: "1 Main Street",
    city: "Mumbai",
    state: "Maharashtra",
    postalCode: "400001",
  };
  assert.equal(validAddress(address), true);
  assert.equal(isSupportedShippingAddress(address), true);
  assert.equal(isSupportedShippingAddress({ ...address, country: " india " }), true);
  assert.equal(isSupportedShippingAddress({ ...address, country: "United States" }), false);
  assert.equal(validAddress({ ...address, city: "" }), false);
});
