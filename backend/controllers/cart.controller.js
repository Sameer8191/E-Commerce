
import Cart from "../models/cart.model.js";
import Product from "../models/product.model.js";
import isValidObjectId from "../utils/isValidObjectId.js";

// POST /api/cart/items
export const addProductToCart = async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;
    const userId = req.user?.userId;

    // 1. Validate authenticated user
    if (!userId || !isValidObjectId(userId)) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // 2. Validate product ID
    if (!isValidObjectId(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    // 3. Validate quantity
    if (
      typeof quantity !== "number" ||
      !Number.isSafeInteger(quantity) ||
      quantity < 1
    ) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be a positive integer",
      });
    }

    // 4. Find an active product
    const product = await Product.findOne({
      _id: productId,
      isActive: true,
    }).select("name price images stock");

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found or unavailable",
      });
    }

    // 5. Validate configured stock
    if (
      !Number.isSafeInteger(product.stock) ||
      product.stock < 0
    ) {
      return res.status(409).json({
        success: false,
        message: "Product stock is not configured correctly",
      });
    }

    if (product.stock === 0) {
      return res.status(409).json({
        success: false,
        message: "Product is out of stock",
      });
    }

    // 6. Find or create the user's cart
    let cart = await Cart.findOne({ user: userId });

    if (!cart) {
      cart = new Cart({
        user: userId,
        items: [],
      });
    }

    // 7. Check whether the product already exists in cart
    const existingItem = cart.items.find(
      (item) => item.product.toString() === productId
    );

    const newQuantity = existingItem
      ? existingItem.quantity + quantity
      : quantity;

    // 8. Check requested total against available stock
    if (newQuantity > product.stock) {
      return res.status(409).json({
        success: false,
        message: "Requested quantity exceeds available stock",
        availableStock: product.stock,
        quantityAlreadyInCart: existingItem
          ? existingItem.quantity
          : 0,
      });
    }

    // 9. Update existing item or add a new item
    if (existingItem) {
      existingItem.quantity = newQuantity;
    } else {
      cart.items.push({
        product: product._id,
        quantity,
      });
    }

    // 10. Save cart
    await cart.save();

    // 11. Return populated cart
    await cart.populate(
      "items.product",
      "name price images stock"
    );

    return res.status(200).json({
      success: true,
      message: "Product added to cart successfully",
      data: cart,
    });
  } catch (error) {
    console.error("Add to cart error:", error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Cart validation failed",
      });
    }

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A cart already exists for this user. Please retry.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to add product to cart",
    });
  }
};


import Cart from "../models/cart.model.js";
import Product from "../models/product.model.js";
import isValidObjectId from "../utils/isValidObjectId.js";

// GET /api/cart
export const getCart = async (req, res) => {
  try {
    const userId = req.user?.userId;

    if (!userId || !isValidObjectId(userId)) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const cart = await Cart.findOne({ user: userId })
      .populate(
        "items.product",
        "name price images stock isActive"
      );

    // Return an empty cart if the user has not added anything
    if (!cart) {
      return res.status(200).json({
        success: true,
        data: {
          items: [],
        },
      });
    }

    // Identify products that are no longer available
    const items = cart.items.map((item) => {
      const product = item.product;

      return {
        product,
        quantity: item.quantity,
        available:
          product !== null &&
          product.isActive === true &&
          Number.isSafeInteger(product.stock) &&
          product.stock >= item.quantity,
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        _id: cart._id,
        user: cart.user,
        items,
        createdAt: cart.createdAt,
        updatedAt: cart.updatedAt,
      },
    });
  } catch (error) {
    console.error("Get cart error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch cart",
    });
  }
};

// PATCH /api/cart/items/:productId
export const updateCartItemQuantity = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { productId } = req.params;
    const { quantity } = req.body;

    // 1. Validate user
    if (!userId || !isValidObjectId(userId)) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // 2. Validate product ID
    if (!isValidObjectId(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    // 3. Validate quantity
    if (
      typeof quantity !== "number" ||
      !Number.isSafeInteger(quantity) ||
      quantity < 1
    ) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be a positive integer",
      });
    }

    // 4. Find active product
    const product = await Product.findOne({
      _id: productId,
      isActive: true,
    }).select("stock");

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found or unavailable",
      });
    }

    // 5. Validate stock configuration
    if (
      !Number.isSafeInteger(product.stock) ||
      product.stock < 0
    ) {
      return res.status(409).json({
        success: false,
        message: "Product stock is not configured correctly",
      });
    }

    // 6. Check requested quantity against stock
    if (quantity > product.stock) {
      return res.status(409).json({
        success: false,
        message: "Requested quantity exceeds available stock",
        availableStock: product.stock,
      });
    }

    // 7. Find the logged-in user's cart
    const cart = await Cart.findOne({ user: userId });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    // 8. Find the requested item
    const item = cart.items.find(
      (item) => item.product.toString() === productId
    );

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Product not found in cart",
      });
    }

    // 9. Update quantity
    item.quantity = quantity;

    await cart.save();

    // 10. Populate product details
    await cart.populate(
      "items.product",
      "name price images stock isActive"
    );

    return res.status(200).json({
      success: true,
      message: "Cart quantity updated successfully",
      data: cart,
    });
  } catch (error) {
    console.error("Update cart quantity error:", error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Cart validation failed",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update cart quantity",
    });
  }
};

// DELETE /api/cart/items/:productId
export const removeCartItem = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { productId } = req.params;

    // 1. Validate user
    if (!userId || !isValidObjectId(userId)) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // 2. Validate product ID
    if (!isValidObjectId(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    // 3. Find the user's cart
    const cart = await Cart.findOne({ user: userId });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    // 4. Find the item
    const itemIndex = cart.items.findIndex(
      (item) => item.product.toString() === productId
    );

    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Product not found in cart",
      });
    }

    // 5. Remove the item
    cart.items.splice(itemIndex, 1);

    await cart.save();

    // 6. Return updated cart
    await cart.populate(
      "items.product",
      "name price images stock isActive"
    );

    return res.status(200).json({
      success: true,
      message: "Product removed from cart successfully",
      data: cart,
    });
  } catch (error) {
    console.error("Remove cart item error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to remove product from cart",
    });
  }
};
