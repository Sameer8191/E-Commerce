
import mongoose from "mongoose";
import Cart from "../models/cart.model.js";
import Product from "../models/product.model.js";

// POST /api/cart/items
export const addProductToCart = async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;

    // 1. Validate product ID
    if (!mongoose.isValidObjectId(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    // 2. Validate quantity
    if (
      !Number.isInteger(quantity) ||
      quantity < 1
    ) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be a positive integer",
      });
    }

    // 3. Find the product
    const product = await Product.findOne({
      _id: productId,
      isActive: true,
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found or unavailable",
      });
    }

    // Assumes your Product model uses `stock`
    if (
      !Number.isInteger(product.stock) ||
      product.stock < 0
    ) {
      return res.status(409).json({
        success: false,
        message: "Product stock is not configured correctly",
      });
    }

    if (quantity > product.stock) {
      return res.status(400).json({
        success: false,
        message: "Requested quantity exceeds available stock",
      });
    }

    // 4. Find or create the user's cart
    let cart = await Cart.findOne({
      user: req.user.userId,
    });

    if (!cart) {
      cart = new Cart({
        user: req.user.userId,
        items: [],
      });
    }

    // 5. Check if product is already in cart
    const existingItem = cart.items.find(
      (item) => item.product.toString() === productId
    );

    if (existingItem) {
      const newQuantity =
        existingItem.quantity + quantity;

      if (newQuantity > product.stock) {
        return res.status(400).json({
          success: false,
          message: "Requested quantity exceeds available stock",
        });
      }

      existingItem.quantity = newQuantity;
    } else {
      cart.items.push({
        product: product._id,
        quantity,
      });
    }

    // 6. Save the cart
    await cart.save();

    // 7. Return the updated cart
    await cart.populate(
      "items.product",
      "name price images stock"
    );

    return res.status(200).json({
      success: true,
      message: "Product added to cart successfully",
      cart,
    });
  } catch (error) {
    console.error("Add to cart error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to add product to cart",
    });
  }
};
