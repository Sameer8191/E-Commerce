import Product from "../models/product.model.js";
import Wishlist from "../models/wishlist.model.js";
import isValidObjectId from "../utils/validateObjectId.js";

export const getWishlist = async (req, res) => {
  try {
    const wishlist = await Wishlist.findOne({ user: req.user.userId })
      .populate({ path: "products", match: { isActive: true, isDeleted: false } })
      .lean();
    return res.status(200).json({ success: true, data: wishlist ?? { products: [] } });
  } catch (error) {
    console.error("Get wishlist failed:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch wishlist" });
  }
};

export const addToWishlist = async (req, res) => {
  const { productId } = req.params;
  if (!isValidObjectId(productId)) {
    return res.status(400).json({ success: false, message: "Invalid product ID" });
  }
  try {
    const product = await Product.exists({ _id: productId, isActive: true, isDeleted: false });
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });

    let wishlist = await Wishlist.findOneAndUpdate(
      { user: req.user.userId },
      { $addToSet: { products: productId } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    ).populate("products");
    return res.status(200).json({ success: true, data: wishlist });
  } catch (error) {
    if (error.code === 11000) {
      const wishlist = await Wishlist.findOneAndUpdate(
        { user: req.user.userId },
        { $addToSet: { products: productId } },
        { new: true, runValidators: true },
      ).populate("products");
      return res.status(200).json({ success: true, data: wishlist });
    }
    console.error("Add wishlist item failed:", error);
    return res.status(500).json({ success: false, message: "Failed to update wishlist" });
  }
};

export const removeFromWishlist = async (req, res) => {
  const { productId } = req.params;
  if (!isValidObjectId(productId)) {
    return res.status(400).json({ success: false, message: "Invalid product ID" });
  }
  try {
    const wishlist = await Wishlist.findOneAndUpdate(
      { user: req.user.userId },
      { $pull: { products: productId } },
      { new: true, runValidators: true },
    ).populate("products");
    if (!wishlist) return res.status(404).json({ success: false, message: "Wishlist not found" });
    return res.status(200).json({ success: true, data: wishlist });
  } catch (error) {
    console.error("Remove wishlist item failed:", error);
    return res.status(500).json({ success: false, message: "Failed to update wishlist" });
  }
};
