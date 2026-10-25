import express from "express";
import {
  createCategory,
  deleteCategory,
  getCategories,
  getCategoryById,
  updateCategory,
} from "../controllers/category.controller.js";
import { authorizePermission, requireAuth } from "../middlewares/auth.middleware.js";
import { PERMISSIONS } from "../config/admin-permissions.js";

const categoryRoutes = express.Router();

// Public category catalog endpoints.
categoryRoutes.get("/", getCategories);
categoryRoutes.get("/:id", getCategoryById);

// Category management is restricted to staff with catalog-management access.
categoryRoutes.post("/", requireAuth, authorizePermission(PERMISSIONS.CATALOG_MANAGE), createCategory);
categoryRoutes
  .route("/:id")
  .put(requireAuth, authorizePermission(PERMISSIONS.CATALOG_MANAGE), updateCategory)
  .patch(requireAuth, authorizePermission(PERMISSIONS.CATALOG_MANAGE), updateCategory)
  .delete(requireAuth, authorizePermission(PERMISSIONS.CATALOG_MANAGE), deleteCategory);

export default categoryRoutes;
