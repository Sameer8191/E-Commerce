import express from "express";
import {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
} from "../controllers/product.controller.js";

// Uncomment when your auth middleware is ready:
// import { protect, adminOnly } from "../middlewares/auth.middleware.js";

const router = express.Router();

// /api/products
router
  .route("/")
  .get(getProducts)
  .post(createProduct); // .post(protect, adminOnly, createProduct)

// /api/products/:id
router
  .route("/:id")
  .get(getProductById)
  .put(updateProduct)   // .put(protect, adminOnly, updateProduct)
  .patch(updateProduct) // Supports both PUT and PATCH for partial updates
  .delete(deleteProduct); // .delete(protect, adminOnly, deleteProduct)

export default router;