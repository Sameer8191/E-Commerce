import express from "express";
import {
  addToWishlist,
  getWishlist,
  removeFromWishlist,
} from "../controllers/wishlist.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const wishlistRouter = express.Router();

wishlistRouter.use(requireAuth);
wishlistRouter.get("/", getWishlist);
wishlistRouter.post("/:productId", addToWishlist);
wishlistRouter.delete("/:productId", removeFromWishlist);

export default wishlistRouter;
