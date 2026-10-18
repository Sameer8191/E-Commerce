import express from "express";
import {
  createCategory,
  deleteCategory,
  getCategories,
  getCategoryById,
  updateCategory,
} from "../controllers/category.controller.js";
import { authorize, requireAuth } from "../middlewares/auth.middleware.js";

const categoryRoutes = express.Router();

// Public category catalog endpoints.
categoryRoutes.get("/", getCategories);
categoryRoutes.get("/:id", getCategoryById);

// Category management is restricted to authenticated admins.
categoryRoutes.post("/", requireAuth, authorize("admin"), createCategory);
categoryRoutes
  .route("/:id")
  .put(requireAuth, authorize("admin"), updateCategory)
  .patch(requireAuth, authorize("admin"), updateCategory)
  .delete(requireAuth, authorize("admin"), deleteCategory);

export default categoryRoutes;
