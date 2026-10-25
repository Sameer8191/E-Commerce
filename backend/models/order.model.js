import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: (value) =>
          Number.isFinite(value) &&
          Math.abs(value * 100 - Math.round(value * 100)) < 1e-8,
        message: "Price must have no more than two decimal places",
      },
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: "Quantity must be an integer",
      },
    },
    image: {
      type: String,
      // Bulk imported products may not have an image. Orders must still be
      // valid; the storefront can render its normal image fallback instead.
      default: "",
      trim: true,
    },
  },
  { _id: false },
);

const shippingAddressSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    addressLine1: {
      type: String,
      required: true,
      trim: true,
    },
    addressLine2: {
      type: String,
      trim: true,
      default: "",
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    state: {
      type: String,
      required: true,
      trim: true,
    },
    postalCode: {
      type: String,
      required: true,
      trim: true,
    },
    country: {
      type: String,
      required: true,
      trim: true,
      default: "India",
    },
  },
  { _id: false },
);

const returnRequestSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ["none", "requested", "approved", "rejected", "refunded"],
      default: "none",
      required: true,
    },
    reason: {
      type: String,
      enum: ["defective", "wrong_item", "not_as_described", "changed_mind", "other"],
      default: null,
    },
    details: { type: String, trim: true, maxlength: 500, default: "" },
    requestedAt: { type: Date, default: null },
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewNote: { type: String, trim: true, maxlength: 500, default: "" },
  },
  { _id: false },
);

const vendorOrderSchema = new mongoose.Schema(
  {
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
      index: true,
    },
    storeName: { type: String, required: true, trim: true },
    items: { type: [orderItemSchema], required: true },
    subtotal: { type: Number, required: true, min: 0 },
    commissionRate: { type: Number, required: true, min: 0, max: 100 },
    commissionAmount: { type: Number, required: true, min: 0 },
    payableAmount: { type: Number, required: true, min: 0 },
    fulfillmentStatus: {
      type: String,
      enum: ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"],
      default: "pending",
      required: true,
    },
    settlementStatus: {
      type: String,
      enum: ["pending", "paid"],
      default: "pending",
      required: true,
    },
    settledAt: { type: Date, default: null },
    settlementReference: { type: String, trim: true, maxlength: 200, default: "" },
  },
  { _id: true },
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    items: {
      type: [orderItemSchema],
      required: true,
      validate: {
        validator: (items) => items.length > 0,
        message: "An order must contain at least one item",
      },
      vendorOrders: {
        type: [vendorOrderSchema],
        default: [],
      },
    },

    shippingAddress: {
      type: shippingAddressSchema,
      required: true,
    },

    subtotal: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: function (value) {
          if (
            !Number.isFinite(value) ||
            Math.abs(value * 100 - Math.round(value * 100)) >= 1e-8
          )
            return false;
          if (!this.items || typeof this.items.reduce !== "function")
            return true;
          const expected = this.items.reduce(
            (sum, item) => sum + item.price * item.quantity,
            0,
          );
          return Math.round(value * 100) === Math.round(expected * 100);
        },
        message: "Subtotal must equal the sum of item prices and quantities",
      },
    },

    shippingFee: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
      validate: {
        validator: (value) =>
          Number.isFinite(value) &&
          Math.abs(value * 100 - Math.round(value * 100)) < 1e-8,
        message: "Shipping fee must have no more than two decimal places",
      },
    },

    discount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
      validate: {
        validator: (value) =>
          Number.isFinite(value) &&
          Math.abs(value * 100 - Math.round(value * 100)) < 1e-8,
        message: "Discount must have no more than two decimal places",
      },

      couponCode: {
        type: String,
        trim: true,
        uppercase: true,
        maxlength: 40,
        default: "",
      },
    },

    totalAmount: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: function (value) {
          if (
            !Number.isFinite(value) ||
            Math.abs(value * 100 - Math.round(value * 100)) >= 1e-8
          )
            return false;
          if (
            ![this.subtotal, this.shippingFee, this.discount].every(
              Number.isFinite,
            )
          )
            return true;
          return (
            Math.round(value * 100) ===
            Math.round((this.subtotal + this.shippingFee - this.discount) * 100)
          );
        },
        message:
          "Total amount must equal subtotal plus shipping fee minus discount",
      },
    },

    paymentMethod: {
      type: String,
      enum: ["razorpay", "cod"],
      default: "razorpay",
      required: true,
    },

    razorpayOrderId: {
      type: String,
      default: undefined,
      unique: true,
      sparse: true,
    },

    razorpayPaymentId: {
      type: String,
      default: undefined,
      unique: true,
      sparse: true,
    },

    paymentOrderCreationToken: {
      type: String,
      default: null,
      select: false,
    },

    paymentOrderCreationExpiresAt: {
      type: Date,
      default: null,
      select: false,
    },

    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
      required: true,
    },

    orderStatus: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
      ],
      default: "pending",
      required: true,
    },

    deliveredAt: { type: Date, default: null },
    returnRequest: { type: returnRequestSchema, default: () => ({}) },

    checkoutIdempotencyKey: {
      type: String,
      trim: true,
      maxlength: 200,
      default: undefined,
    },

    currency: {
      type: String,
      enum: ["INR"],
      default: "INR",
      required: true,
    },

    inventoryReleasedAt: {
      type: Date,
      default: null,
    },

    inventoryExpiresAt: {
  type: Date,
  default: null,
},

checkoutFingerprint: {
  type: String,
  required: true,
  match: /^[a-f0-9]{64}$/,
},

    refundStatus: {
      type: String,
      enum: ["not_required", "pending", "processing", "processed", "failed"],
      default: "not_required",
      required: true,
    },

    refundPaymentId: { type: String, default: null, trim: true },
    refundReceipt: { type: String, default: null, trim: true },
    refundAttempts: { type: Number, default: 0, min: 0 },
    refundNextAttemptAt: { type: Date, default: null },
    refundError: { type: String, default: null, maxlength: 1000 },
    manualRefundReference: { type: String, default: null, trim: true, maxlength: 200 },

    placedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

orderSchema.index(
  { user: 1, checkoutIdempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { checkoutIdempotencyKey: { $type: "string" } },
    name: "uniq_user_checkout_idempotency",
  },
);

orderSchema.index({ user: 1, placedAt: -1, _id: -1 });
orderSchema.index({ orderStatus: 1, refundStatus: 1, refundNextAttemptAt: 1 });

const Order = mongoose.model("Order", orderSchema);

export default Order;
