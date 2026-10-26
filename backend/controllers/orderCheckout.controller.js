import crypto from "node:crypto";
import mongoose from "mongoose";
import Cart from "../models/cart.model.js";
import Category from "../models/category.model.js";
import Vendor from "../models/vendor.model.js";
import AdminSetting from "../models/admin-setting.model.js";
import Order from "../models/order.model.js";
import Product from "../models/product.model.js";
import Coupon from "../models/coupon.model.js";
import { calculateCouponDiscount, normalizeCouponCode } from "../utils/coupon.utils.js";
import {
  MAX_ORDER_AMOUNT_PAISE,
  RESERVATION_MINUTES,
} from "../config/order.config.js";
import {
  assertSameCheckout,
  createHttpError,
  fingerprintCheckout,
  isSupportedShippingAddress,
  moneyToPaise,
  normalizeAddress,
  sendError,
  validAddress,
} from "../utils/order.utils.js";
import { getUserId } from "../utils/auth.utils.js";
import { notifyCustomerOrder } from "../services/customerNotificationService.js";
// Create Order

export const createOrder = async (req, res) => {
  const userId = getUserId(req);

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  const { shippingAddress, paymentMethod = "razorpay" } = req.body ?? {};
  const couponCode = normalizeCouponCode(req.body?.couponCode);
  const idempotencyKey = req.get("Idempotency-Key")?.trim();

  if (!idempotencyKey || idempotencyKey.length > 200) {
    return res.status(400).json({
      success: false,
      message: "A valid Idempotency-Key header is required",
    });
  }

  if (!validAddress(shippingAddress)) {
    return res.status(400).json({
      success: false,
      message: "A valid shipping address is required",
    });
  }
  if (!isSupportedShippingAddress(shippingAddress)) {
    return res.status(400).json({
      success: false,
      message: "We currently ship to addresses in India only.",
    });
  }

  if (!["razorpay", "cod"].includes(paymentMethod)) {
    return res.status(400).json({
      success: false,
      message: "Payment method must be razorpay or cod",
    });
  }
  if (req.body?.couponCode !== undefined && (typeof req.body.couponCode !== "string" || couponCode.length > 40)) {
    return res.status(400).json({ success: false, message: "Invalid coupon code" });
  }

  // This example assumes zero-priced orders are not allowed.
  // If free orders are a supported feature, handle them through a separate
  // flow that confirms the order without calling Razorpay.
  const fingerprint = fingerprintCheckout({ shippingAddress, paymentMethod, couponCode });

  let session;

  try {
    const existing = await Order.findOne({
      user: userId,
      checkoutIdempotencyKey: idempotencyKey,
    }).lean();

    if (existing) {
      assertSameCheckout(existing, fingerprint);

      return res.status(200).json({
        success: true,
        message: "Checkout already processed",
        data: existing,
        idempotentReplay: true,
      });
    }

    session = await mongoose.startSession();

    let createdOrder = null;
    let idempotentReplay = false;

    await session.withTransaction(async () => {
      // withTransaction may rerun its callback; reset callback state each time.
      createdOrder = null;
      idempotentReplay = false;

      const priorOrder = await Order.findOne({
        user: userId,
        checkoutIdempotencyKey: idempotencyKey,
      }).session(session);

      if (priorOrder) {
        assertSameCheckout(priorOrder, fingerprint);
        createdOrder = priorOrder;
        idempotentReplay = true;
        return;
      }

      const cart = await Cart.findOne({ user: userId })
        .session(session)
        .populate({
          path: "items.product",
          select: "name price images stock variants isActive isDeleted category vendor",
        });

      if (!cart?.items?.length) {
        throw createHttpError(400, "Your cart is empty");
      }

      // Merge duplicate product rows defensively, even if the cart schema
      // already validates against duplicates.
      const merged = new Map();

      for (const cartItem of cart.items) {
        const product = cartItem.product;

        if (!product || !product.isActive || product.isDeleted) {
          throw createHttpError(
            409,
            "One or more products in your cart are unavailable",
          );
        }

        if (!(await Category.exists({ _id: product.category, isActive: true }))) {
          throw createHttpError(
            409,
            `The category for ${product.name} is unavailable`,
          );
        }
        if (!Number.isSafeInteger(cartItem.quantity) || cartItem.quantity < 1) {
          throw createHttpError(400, `Invalid quantity for ${product.name}`);
        }

        const variant = cartItem.variant || "";
        if ((product.variants?.length && !product.variants.includes(variant)) || (!product.variants?.length && variant)) throw createHttpError(409, `Choose an available option for ${product.name}`);
        const key = `${product._id.toString()}:${variant}`;
        const previousItem = merged.get(key);
        const quantity = (previousItem?.quantity ?? 0) + cartItem.quantity;

        if (!Number.isSafeInteger(quantity) || quantity < 1) {
          throw createHttpError(400, "Product quantity is too large");
        }

        merged.set(key, { product, variant, quantity });
      }

      // Consistent write ordering reduces avoidable write conflicts.
      const entries = [...merged.values()].sort((a, b) =>
        a.product._id.toString().localeCompare(b.product._id.toString()),
      );
      const vendorIds = [...new Set(entries.map(({ product }) => product.vendor?.toString()).filter(Boolean))];
      const vendors = await Vendor.find({
        _id: { $in: vendorIds },
        status: "approved",
      }).session(session);
      const vendorById = new Map(vendors.map((vendor) => [vendor._id.toString(), vendor]));
      if (vendorById.size !== vendorIds.length) {
        throw createHttpError(409, "A seller in your cart is no longer available");
      }
      const storeSettings = await AdminSetting.findOne({ key: "store" }).session(session).lean();
      const defaultCommissionRate = storeSettings?.marketplaceCommissionRate ?? 10;

      const items = [];
      const itemsByVendor = new Map();
      let subtotalPaise = 0;

      for (const { product, quantity, variant } of entries) {
        const vendorId = product.vendor?.toString();
        const vendor = vendorId ? vendorById.get(vendorId) : null;
        if (!vendor) {
          throw createHttpError(409, `Seller for ${product.name} is unavailable`);
        }
        const pricePaise = moneyToPaise(product.price);

        if (pricePaise === null) {
          throw createHttpError(409, `Invalid price for ${product.name}`);
        }

        if (pricePaise === 0) {
          throw createHttpError(
            409,
            `Free products are not supported in checkout: ${product.name}`,
          );
        }

        const totalProductQuantity = entries.filter((entry) => entry.product._id.toString() === product._id.toString()).reduce((sum, entry) => sum + entry.quantity, 0);
        if (!Number.isSafeInteger(product.stock) || product.stock < totalProductQuantity) {
          throw createHttpError(409, `Insufficient stock for ${product.name}`);
        }

        const lineTotalPaise = pricePaise * quantity;
        const nextSubtotal = subtotalPaise + lineTotalPaise;

        if (
          !Number.isSafeInteger(lineTotalPaise) ||
          !Number.isSafeInteger(nextSubtotal) ||
          nextSubtotal > MAX_ORDER_AMOUNT_PAISE
        ) {
          throw createHttpError(400, "Order total is too large");
        }

        subtotalPaise = nextSubtotal;

        const orderItem = {
          product: product._id,
          name: product.name,
          variant,
          price: pricePaise / 100,
          quantity,
          image: product.images?.[0]?.url || "",
        };
        items.push(orderItem);
        const vendorItems = itemsByVendor.get(vendorId) || [];
        vendorItems.push(orderItem);
        itemsByVendor.set(vendorId, vendorItems);
      }

      let discountPaise = 0;
      let coupon = null;
      if (couponCode) {
        coupon = await Coupon.findOne({ code: couponCode }).session(session).lean();
        if (!coupon) throw createHttpError(400, "This coupon code is not valid");
        const couponResult = calculateCouponDiscount(coupon, subtotalPaise);
        if (!couponResult.valid) throw createHttpError(400, couponResult.message);
        discountPaise = couponResult.discountPaise;
      }
      const totalPaise = subtotalPaise - discountPaise;
      if (!Number.isSafeInteger(totalPaise) || totalPaise <= 0) {
        throw createHttpError(400, "The order total must be greater than zero");
      }
      if (paymentMethod === "razorpay" && totalPaise < 100) {
        throw createHttpError(
          400,
          "Razorpay orders must total at least 100 paise",
        );
      }
      if (coupon) {
        const now = new Date();
        const couponFilter = {
          _id: coupon._id,
          isActive: true,
          usageCount: coupon.usageCount,
          $and: [
            { $or: [{ startsAt: null }, { startsAt: { $exists: false } }, { startsAt: { $lte: now } }] },
            { $or: [{ expiresAt: null }, { expiresAt: { $exists: false } }, { expiresAt: { $gte: now } }] },
          ],
        };
        if (coupon.usageLimit !== null && coupon.usageLimit !== undefined) {
          couponFilter.usageCount = { $eq: coupon.usageCount, $lt: coupon.usageLimit };
        }
        const usageUpdate = await Coupon.updateOne(couponFilter, { $inc: { usageCount: 1 } }, { session });
        if (usageUpdate.modifiedCount !== 1) {
          throw createHttpError(409, "This coupon is no longer available. Refresh checkout and try again.");
        }
      }

      // Reserve stock atomically. All deductions roll back if any later
      // operation in this transaction fails.
      for (const item of items) {
        const result = await Product.updateOne(
          {
            _id: item.product,
            isActive: true,
            isDeleted: false,
            stock: { $gte: item.quantity },
          },
          { $inc: { stock: -item.quantity } },
          { session },
        );

        if (result.modifiedCount !== 1) {
          throw createHttpError(
            409,
            `Stock changed while placing your order for ${item.name}`,
          );
        }
      }

      const now = new Date();
      const inventoryExpiresAt =
        paymentMethod === "razorpay"
          ? new Date(now.getTime() + RESERVATION_MINUTES * 60_000)
          : null;
      const vendorOrders = [...itemsByVendor.entries()].map(([vendorId, vendorItems]) => {
        const vendor = vendorById.get(vendorId);
        const vendorSubtotalPaise = vendorItems.reduce(
          (sum, item) => sum + moneyToPaise(item.price) * item.quantity,
          0,
        );
        const commissionRate = vendor.isPlatform
          ? 0
          : vendor.commissionRate ?? defaultCommissionRate;
        const commissionPaise = Math.round((vendorSubtotalPaise * commissionRate) / 100);
        return {
          vendor: vendor._id,
          storeName: vendor.storeName,
          items: vendorItems,
          subtotal: vendorSubtotalPaise / 100,
          commissionRate,
          commissionAmount: commissionPaise / 100,
          payableAmount: (vendorSubtotalPaise - commissionPaise) / 100,
          fulfillmentStatus: paymentMethod === "cod" ? "confirmed" : "pending",
        };
      });

      const [order] = await Order.create(
        [
          {
            orderNumber: `ORD-${now.getTime()}-${crypto
              .randomBytes(5)
              .toString("hex")
              .toUpperCase()}`,
            user: userId,
            checkoutIdempotencyKey: idempotencyKey,
            checkoutFingerprint: fingerprint,
            items,
            vendorOrders,
            shippingAddress: normalizeAddress(shippingAddress),
            currency: "INR",
            subtotal: subtotalPaise / 100,
            shippingFee: 0,
            discount: discountPaise / 100,
            couponCode,
            totalAmount: totalPaise / 100,
            paymentMethod,
            paymentStatus: "pending",
            orderStatus: paymentMethod === "cod" ? "confirmed" : "pending",
            refundStatus: "not_required",
            inventoryReleasedAt: null,
            inventoryExpiresAt,
          },
        ],
        { session },
      );

      // Clear the cart for both payment methods. A retry must not create
      // another order from the same cart contents.
      const cartResult = await Cart.updateOne(
        { _id: cart._id, user: userId },
        { $set: { items: [] } },
        { session, runValidators: true },
      );

      if (cartResult.matchedCount !== 1) {
        throw createHttpError(409, "Cart changed while placing the order");
      }

      createdOrder = order;
    });

    if (!idempotentReplay && createdOrder) {
      const orderNumber = createdOrder.orderNumber;
      void notifyCustomerOrder({
        order: createdOrder,
        eventKey: `order:${createdOrder._id}:placed`,
        title: "Order placed",
        message: paymentMethod === "cod"
          ? `Order ${orderNumber} is confirmed. Pay when your delivery arrives.`
          : `Order ${orderNumber} is placed. Complete payment to confirm it.`,
        subject: `Goodthings order ${orderNumber} placed`,
      });
    }
    return res.status(idempotentReplay ? 200 : 201).json({
      success: true,
      message: idempotentReplay
        ? "Checkout already processed"
        : "Order placed successfully",
      data: createdOrder,
      ...(idempotentReplay ? { idempotentReplay: true } : {}),
    });
  } catch (error) {
    // The unique index is the final guard against concurrent requests using
    // the same key. Fetch the winner and enforce payload matching.
    if (error?.code === 11000) {
      try {
        const existing = await Order.findOne({
          user: userId,
          checkoutIdempotencyKey: idempotencyKey,
        }).lean();

        if (existing) {
          assertSameCheckout(existing, fingerprint);

          return res.status(200).json({
            success: true,
            message: "Checkout already processed",
            data: existing,
            idempotentReplay: true,
          });
        }
      } catch (replayError) {
        return sendError(res, replayError, "Failed to place order");
      }
    }

    return sendError(res, error, "Failed to place order");
  } finally {
    if (session) {
      await session.endSession();
    }
  }
};
