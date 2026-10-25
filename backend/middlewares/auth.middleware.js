import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import Vendor from "../models/vendor.model.js";
import {
  getPermissionsForRole,
  hasAnyPermission,
  PERMISSIONS,
} from "../config/admin-permissions.js";

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
      !decoded.userId ||
      !Number.isSafeInteger(decoded.tokenVersion) ||
      decoded.tokenVersion < 0
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid token payload",
      });
    }

    const user = await User.findById(decoded.userId)
      .select("+authTokenVersion");

    if (
      !user ||
      !user.isActive ||
      decoded.tokenVersion !== user.authTokenVersion
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid or inactive account",
      });
    }

    if (!user.isVerified) {
      return res.status(403).json({
        success: false,
        code: "EMAIL_NOT_VERIFIED",
        message: "Verify your email before accessing this resource",
      });
    }

    req.user = {
      ...user.toObject(),
      userId: user._id.toString(),
      permissions: getPermissionsForRole(user.role),
    };

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

export const authorizePermission = (...permissions) => {
  return (req, res, next) => {
    if (!req.user || !hasAnyPermission(req.user.role, permissions)) {
      return res.status(403).json({
        success: false,
        code: "INSUFFICIENT_PERMISSION",
        message: "Access denied. Your staff role does not have permission for this action.",
      });
    }
    return next();
  };
};

export const requireProductManagement = async (req, res, next) => {
    if (hasAnyPermission(req.user?.role, [PERMISSIONS.CATALOG_MANAGE])) {
      return next();
    }

    if (req.user?.role !== "vendor") {
      return res.status(403).json({
        success: false,
        code: "INSUFFICIENT_PERMISSION",
        message: "Access denied. Product management permission is required.",
      });
    }

    try {
      const vendor = await Vendor.findOne({
        owner: req.user.userId,
        status: "approved",
        isPlatform: false,
      });
      if (!vendor) {
        return res.status(403).json({
          success: false,
          code: "VENDOR_NOT_APPROVED",
          message: "An approved vendor account is required.",
        });
      }
      req.vendor = vendor;
      return next();
    } catch (error) {
      return next(error);
    }
};

export const requireApprovedVendor = async (req, res, next) => {
    if (req.user?.role !== "vendor") {
      return res.status(403).json({
        success: false,
        code: "VENDOR_ACCESS_REQUIRED",
        message: "An approved vendor account is required.",
      });
    }
    try {
      const vendor = await Vendor.findOne({
        owner: req.user.userId,
        status: "approved",
        isPlatform: false,
      });
      if (!vendor) {
        return res.status(403).json({
          success: false,
          code: "VENDOR_NOT_APPROVED",
          message: "Your vendor account is not active.",
        });
      }
      req.vendor = vendor;
      return next();
    } catch (error) {
      return next(error);
    }
};
