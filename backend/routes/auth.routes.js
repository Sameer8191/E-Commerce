import express from "express";
import {
  forgotPassword,
  login,
  register,
  verifyEmail
} from "../controllers/auth.controller.js";

const authRouter = express.Router();

authRouter.post("/register", register);
authRouter.post("/login", login);
authRouter.post("/verify-email",verifyEmail);
authRouter.post("/forgot-password", forgotPassword);

export default authRouter;