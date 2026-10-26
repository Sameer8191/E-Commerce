import mongoose from "mongoose";
import Order from "../models/order.model.js";
import Product from "../models/product.model.js";
import Review from "../models/review.model.js";
import isValidObjectId from "../utils/validateObjectId.js";

const refreshProductRating = async (productId) => {
  const [rating] = await Review.aggregate([
    { $match: { product: new mongoose.Types.ObjectId(productId) } },
    { $group: { _id: null, average: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);
  await Product.updateOne(
    { _id: productId },
    {
      $set: {
        ratingsAverage: rating?.average ?? 0,
        ratingsCount: rating?.count ?? 0,
      },
    },
  );
};

export const getProductReviews = async (req, res) => {
  const { productId } = req.params;
  if (!isValidObjectId(productId)) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid product ID" });
  }
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 10);
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    return res.status(400).json({ success: false, message: "Invalid pagination parameters" });
  }
  const skip = (page - 1) * limit;
  if (!Number.isSafeInteger(skip)) {
    return res.status(400).json({ success: false, message: "Invalid pagination parameters" });
  }
  try {
    const filter = { product: productId };
    const [reviews, total] = await Promise.all([
      Review.find(filter)
        .populate("user", "name avatar")
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Review.countDocuments(filter),
    ]);
    return res.status(200).json({ success: true, data: reviews, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    console.error("Get product reviews failed:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch reviews" });
  }
};

export const createReview = async (req, res) => {
  const { productId } = req.params;
  const userId = req.user.userId;
  const { rating, title, comment } = req.body ?? {};
  if (!isValidObjectId(productId)) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid product ID" });
  }
  if (
    !Number.isInteger(rating) ||
    rating < 1 ||
    rating > 5 ||
    typeof comment !== "string" ||
    !comment.trim() ||
    comment.trim().length > 2000 ||
    (title !== undefined &&
      (typeof title !== "string" || title.trim().length > 100))
  ) {
    return res
      .status(400)
      .json({
        success: false,
        message: "Rating, title, or comment is invalid",
      });
  }
  try {
    const product = await Product.findOne({
      _id: productId,
      isActive: true,
      isDeleted: false,
    }).select("_id");
    if (!product)
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });

    const isVerifiedPurchase = await Order.exists({
      user: userId,
      orderStatus: "delivered",
      $or: [{ paymentStatus: "paid" }, { paymentMethod: "cod" }],
      "items.product": productId,
    });
    const review = await Review.create({
      user: userId,
      product: productId,
      rating,
      ...(title !== undefined && { title: title.trim() }),
      comment: comment.trim(),
      isVerifiedPurchase: Boolean(isVerifiedPurchase),
    });
    await refreshProductRating(productId);
    return res.status(201).json({ success: true, data: review });
  } catch (error) {
    if (error.code === 11000)
      return res
        .status(409)
        .json({
          success: false,
          message: "You have already reviewed this product",
        });
    console.error("Create review failed:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to create review" });
  }
};

export const deleteReview = async (req, res) => {
  const { reviewId } = req.params;
  if (!isValidObjectId(reviewId)) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid review ID" });
  }
  try {
    const review = await Review.findOneAndDelete({
      _id: reviewId,
      user: req.user.userId,
    });
    if (!review)
      return res
        .status(404)
        .json({ success: false, message: "Review not found" });
    await refreshProductRating(review.product);
    return res.status(200).json({ success: true, message: "Review deleted" });
  } catch (error) {
    console.error("Delete review failed:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to delete review" });
  }
};
