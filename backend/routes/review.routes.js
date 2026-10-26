import express from "express";
import {
  createReview,
  deleteReview,
  getProductReviews,
  getMyProductReview,
  updateReview,
} from "../controllers/review.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const reviewRouter = express.Router();

reviewRouter.get("/product/:productId", getProductReviews);
reviewRouter.get("/product/:productId/mine", requireAuth, getMyProductReview);
reviewRouter.post("/product/:productId", requireAuth, createReview);
reviewRouter.put("/:reviewId", requireAuth, updateReview);
reviewRouter.delete("/:reviewId", requireAuth, deleteReview);

export default reviewRouter;
