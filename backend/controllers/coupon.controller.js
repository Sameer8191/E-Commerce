import Cart from "../models/cart.model.js";
import Coupon from "../models/coupon.model.js";
import mongoose from "mongoose";
import { calculateCouponDiscount, normalizeCouponCode } from "../utils/coupon.utils.js";
import { getUserId } from "../utils/auth.utils.js";
import { moneyToPaise } from "../utils/order.utils.js";

const getCartSubtotalPaise = async (userId) => {
  const cart = await Cart.findOne({ user: userId }).populate({
    path: "items.product",
    select: "price isActive isDeleted",
  });
  if (!cart?.items?.length) return 0;
  let subtotal = 0;
  for (const item of cart.items) {
    if (!item.product || !item.product.isActive || item.product.isDeleted) continue;
    const price = moneyToPaise(item.product.price);
    if (price === null) throw new Error("Cart contains a product with an invalid price");
    subtotal += price * item.quantity;
  }
  return subtotal;
};

export const validateCartCoupon = async (req, res) => {
  try {
    const code = normalizeCouponCode(req.body?.code);
    if (!code || code.length > 40) {
      return res.status(400).json({ success: false, message: "Enter a valid coupon code." });
    }
    const coupon = await Coupon.findOne({ code }).lean();
    if (!coupon) return res.status(404).json({ success: false, message: "This coupon code is not valid." });
    const subtotalPaise = await getCartSubtotalPaise(getUserId(req));
    const result = calculateCouponDiscount(coupon, subtotalPaise);
    if (!result.valid) return res.status(422).json({ success: false, message: result.message });
    return res.json({
      success: true,
      data: {
        code: coupon.code,
        discount: result.discountPaise / 100,
        subtotal: subtotalPaise / 100,
      },
    });
  } catch (error) {
    console.error("Validate cart coupon error:", error);
    return res.status(500).json({ success: false, message: "Could not validate this coupon." });
  }
};

class CouponInputError extends Error {}

const validateCouponInput = (body) => {
  const code = normalizeCouponCode(body?.code);
  const discountType = body?.discountType;
  const discountValue = Number(body?.discountValue);
  const minimumSubtotal = Number(body?.minimumSubtotal || 0);
  const maximumDiscount = body?.maximumDiscount === "" || body?.maximumDiscount === null || body?.maximumDiscount === undefined
    ? null
    : Number(body.maximumDiscount);
  const usageLimit = body?.usageLimit === "" || body?.usageLimit === null || body?.usageLimit === undefined
    ? null
    : Number(body.usageLimit);
  const startsAt = body?.startsAt ? new Date(body.startsAt) : null;
  const expiresAt = body?.expiresAt ? new Date(body.expiresAt) : null;
  if (!/^[A-Z0-9_-]{3,40}$/.test(code)) throw new CouponInputError("Code must be 3–40 letters, numbers, hyphens, or underscores.");
  if (!["percentage", "fixed"].includes(discountType)) throw new CouponInputError("Choose a percentage or fixed discount.");
  if (!Number.isFinite(discountValue) || discountValue <= 0 || (discountType === "percentage" && discountValue > 100)) throw new CouponInputError("Discount value is invalid.");
  const hasPaisePrecision = (value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-8;
  if (!Number.isFinite(minimumSubtotal) || minimumSubtotal < 0 || !hasPaisePrecision(minimumSubtotal)) throw new CouponInputError("Minimum subtotal must be a non-negative amount with up to two decimal places.");
  if (discountType === "fixed" && !hasPaisePrecision(discountValue)) throw new CouponInputError("Fixed discount must have up to two decimal places.");
  if (maximumDiscount !== null && (!Number.isFinite(maximumDiscount) || maximumDiscount <= 0 || !hasPaisePrecision(maximumDiscount))) throw new CouponInputError("Maximum discount must be a positive amount with up to two decimal places.");
  if (usageLimit !== null && (!Number.isSafeInteger(usageLimit) || usageLimit < 1)) throw new CouponInputError("Usage limit must be a positive whole number.");
  if (startsAt && !Number.isFinite(startsAt.getTime())) throw new CouponInputError("Start date is invalid.");
  if (expiresAt && !Number.isFinite(expiresAt.getTime())) throw new CouponInputError("Expiry date is invalid.");
  if (startsAt && expiresAt && startsAt >= expiresAt) throw new CouponInputError("Expiry must be after the start date.");
  return { code, discountType, discountValue, minimumSubtotal, maximumDiscount, usageLimit, startsAt, expiresAt };
};

export const getCoupons = async (req, res) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 }).limit(200).lean();
    return res.json({ success: true, data: coupons });
  } catch (error) {
    console.error("Get coupons error:", error);
    return res.status(500).json({ success: false, message: "Could not load coupons." });
  }
};

export const createCoupon = async (req, res) => {
  try {
    const values = validateCouponInput(req.body);
    const coupon = await Coupon.create({ ...values, createdBy: getUserId(req) });
    return res.status(201).json({ success: true, data: coupon });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: "A coupon with this code already exists." });
    if (error instanceof CouponInputError || error.name === "ValidationError") {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error("Create coupon error:", error);
    return res.status(500).json({ success: false, message: "Could not create coupon." });
  }
};

export const setCouponActive = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.couponId)) return res.status(400).json({ success: false, message: "Invalid coupon ID." });
    if (typeof req.body?.isActive !== "boolean") return res.status(400).json({ success: false, message: "Provide an active status." });
    const coupon = await Coupon.findByIdAndUpdate(req.params.couponId, { $set: { isActive: req.body.isActive } }, { new: true, runValidators: true });
    if (!coupon) return res.status(404).json({ success: false, message: "Coupon not found." });
    return res.json({ success: true, data: coupon });
  } catch (error) {
    console.error("Update coupon error:", error);
    return res.status(500).json({ success: false, message: "Could not update this coupon." });
  }
};
