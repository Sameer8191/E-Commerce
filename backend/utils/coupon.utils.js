export const normalizeCouponCode = (value) =>
  typeof value === "string" ? value.trim().toUpperCase() : "";

export const calculateCouponDiscount = (coupon, subtotalPaise, now = new Date()) => {
  if (!coupon?.isActive) return { valid: false, message: "This coupon is not available." };
  if (!Number.isSafeInteger(subtotalPaise) || subtotalPaise <= 0) {
    return { valid: false, message: "Add items to your cart before using a coupon." };
  }
  if (coupon.startsAt && now < new Date(coupon.startsAt)) {
    return { valid: false, message: "This coupon is not active yet." };
  }
  if (coupon.expiresAt && now > new Date(coupon.expiresAt)) {
    return { valid: false, message: "This coupon has expired." };
  }
  if (coupon.usageLimit !== null && coupon.usageLimit !== undefined && coupon.usageCount >= coupon.usageLimit) {
    return { valid: false, message: "This coupon has reached its usage limit." };
  }
  const minimumPaise = Math.round(Number(coupon.minimumSubtotal || 0) * 100);
  if (subtotalPaise < minimumPaise) {
    return {
      valid: false,
      message: `Your subtotal must be at least ₹${Number(coupon.minimumSubtotal).toFixed(2)} to use this coupon.`,
    };
  }
  let discountPaise = coupon.discountType === "percentage"
    ? Math.round(subtotalPaise * Number(coupon.discountValue) / 100)
    : Math.round(Number(coupon.discountValue) * 100);
  if (coupon.maximumDiscount !== null && coupon.maximumDiscount !== undefined) {
    discountPaise = Math.min(discountPaise, Math.round(Number(coupon.maximumDiscount) * 100));
  }
  discountPaise = Math.min(subtotalPaise, discountPaise);
  if (!Number.isSafeInteger(discountPaise) || discountPaise <= 0) {
    return { valid: false, message: "This coupon does not apply to this order." };
  }
  return { valid: true, discountPaise };
};
