import express from "express";
import {
  createReview,
  deleteReview,
  getProductReviews,
} from "../controllers/review.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const reviewRouter = express.Router();

reviewRouter.get("/product/:productId", getProductReviews);
reviewRouter.post("/product/:productId", requireAuth, createReview);
reviewRouter.delete("/:reviewId", requireAuth, deleteReview);

export default reviewRouter;
