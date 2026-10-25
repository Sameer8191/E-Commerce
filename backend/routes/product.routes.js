import express from "express";
import {
  createProduct,
  deleteProduct,
  updateProduct,
} from "../controllers/product.controller.js";
import {
  getProductById,
  getProducts,
} from "../controllers/productCatalog.controller.js";
import { requireAuth, requireProductManagement } from "../middlewares/auth.middleware.js";
import { uploadProductImages } from "../middlewares/upload.middleware.js";

const productRoutes = express.Router();

// Public catalog endpoints.
productRoutes.get("/", getProducts);
productRoutes.get("/:id", getProductById);

// Product management is restricted to staff with catalog-management access.
productRoutes.post(
  "/",
  requireAuth,
  requireProductManagement,
  uploadProductImages,
  createProduct,
);
productRoutes
  .route("/:id")
  .put(requireAuth, requireProductManagement, uploadProductImages, updateProduct)
  .patch(requireAuth, requireProductManagement, uploadProductImages, updateProduct)
  .delete(requireAuth, requireProductManagement, deleteProduct);

export default productRoutes;
