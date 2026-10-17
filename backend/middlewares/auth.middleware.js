
import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

// AUTHENTICATION: Verify token and identify the user
export const requireAuth = async (req, res, next) => {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  try {
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      throw new Error("JWT_SECRET is required");
    }

    const token = authorization.slice(7);
    const decoded = jwt.verify(token, secret);

    if (
      typeof decoded === "string" ||
      !decoded.userId
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid token payload",
      });
    }

    const user = await User.findById(decoded.userId)
      .select("-password");

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: "Invalid or inactive account",
      });
    }

    req.user = user;

    return next();
  } catch (error) {
    if (error.message === "JWT_SECRET is required") {
      return next(error);
    }

    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

// AUTHORIZATION: Restrict access based on user roles
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You do not have permission.",
      });
    }

    return next();
  };
};
