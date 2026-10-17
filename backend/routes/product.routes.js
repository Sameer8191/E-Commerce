import express from "express";
import {
  createProduct,
  deleteProduct,
  getProductById,
  getProducts,
  updateProduct,
} from "../controllers/product.controller.js";
import { authorize, requireAuth } from "../middlewares/auth.middleware.js";
import { uploadProductImages } from "../middlewares/upload.middleware.js";

const productRoutes = express.Router();

// Public catalog endpoints.
productRoutes.get("/", getProducts);
productRoutes.get("/:id", getProductById);

// Product management is restricted to authenticated admins.
productRoutes.post(
  "/",
  requireAuth,
  authorize("admin"),
  uploadProductImages,
  createProduct,
);
productRoutes
  .route("/:id")
  .put(requireAuth, authorize("admin"), uploadProductImages, updateProduct)
  .patch(requireAuth, authorize("admin"), uploadProductImages, updateProduct)
  .delete(requireAuth, authorize("admin"), deleteProduct);

export default productRoutes;
