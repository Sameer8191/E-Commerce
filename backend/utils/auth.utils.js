import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import isValidObjectId from "./validateObjectId.js";

export const getUserId = (req) => {
  const id = req.user?.userId ?? req.user?._id?.toString();
  return id && isValidObjectId(id) ? id : null;
};

export const createToken = (userId) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is required");

  return jwt.sign({ userId }, secret, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
};

export const toPublicUser = (user) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  phone: user.phone,
  avatar: user.avatar,
  role: user.role,
  addresses: user.addresses,
  createdAt: user.createdAt,
});

export const hashOtp = (otp) => {
  const secret = process.env.OTP_HMAC_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error("OTP_HMAC_SECRET or JWT_SECRET is required");
  return crypto.createHmac("sha256", secret).update(otp).digest("hex");
};
