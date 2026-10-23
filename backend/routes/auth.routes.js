import express from "express";
import { authRateLimit } from "../middlewares/authRateLimit.middleware.js";
import {
  forgotPassword,
  login,
  register,
  resetPassword,
  verifyEmail
} from "../controllers/auth.controller.js";

const authRouter = express.Router();

authRouter.post("/register", authRateLimit({ name: "register", limit: 5, windowMs: 15 * 60 * 1000 }), register);
authRouter.post("/login", authRateLimit({ name: "login", limit: 10, windowMs: 15 * 60 * 1000 }), login);
authRouter.post("/verify-email", authRateLimit({ name: "verify-email", limit: 8, windowMs: 15 * 60 * 1000, identityField: "email" }), verifyEmail);
authRouter.post("/forgot-password", authRateLimit({ name: "forgot-password", limit: 4, windowMs: 60 * 60 * 1000, identityField: "email" }), forgotPassword);
authRouter.post("/reset-password", authRateLimit({ name: "reset-password", limit: 8, windowMs: 15 * 60 * 1000, identityField: "email" }), resetPassword);

export default authRouter;
