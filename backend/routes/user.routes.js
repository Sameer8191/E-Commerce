
import express from "express";

import {
  getMyProfile,
  updateMyProfile,
  getAllUsers,
  getUserById,
  updateUserRole,
  deleteUser,
} from "../controllers/user.controller.js";

import { requireAuth } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Customer profile
router.get("/me", requireAuth, getMyProfile);
router.patch("/me", requireAuth, updateMyProfile);

// Admin user management
router.get("/", requireAuth, authorize("admin"), getAllUsers);
router.get("/:id", requireAuth, authorize("admin"), getUserById);
router.patch("/:id/role", requireAuth, authorize("admin"), updateUserRole);
router.delete("/:id", requireAuth, authorize("admin"), deleteUser);

export default router;
