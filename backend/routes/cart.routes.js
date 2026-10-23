import express from "express";
import {
  addProductToCart,
  getCart,
  removeCartItem,
  updateCartItemQuantity,
} from "../controllers/cart.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const cartRouter = express.Router();

cartRouter.use(requireAuth);
cartRouter.get("/", getCart);
cartRouter.post("/items", addProductToCart);
cartRouter.patch("/items/:productId", updateCartItemQuantity);
cartRouter.delete("/items/:productId", removeCartItem);

export default cartRouter;
