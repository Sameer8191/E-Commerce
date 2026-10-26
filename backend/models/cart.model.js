
import mongoose from "mongoose";

const cartSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        variant: { type: String, trim: true, maxlength: 80, default: "" },

        quantity: {
          type: Number,
          required: true,
          min: 1,
          default: 1,
          validate: {
            validator: Number.isInteger,
            message: "Quantity must be an integer",
          },
        },
      },
    ],
    mergedGuestCartIds: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true, optimisticConcurrency: true }
);

cartSchema.path("items").validate(
  (items) => {
    const ids = items.map((item) => `${item.product?.toString()}:${item.variant || ""}`);
    return ids.length === new Set(ids).size;
  },
  "A product can appear only once in the cart"
);

const Cart = mongoose.model("Cart", cartSchema);

export default Cart;
