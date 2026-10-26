import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import User from "../models/user.model.js";
import { createToken, hashOtp, toPublicUser } from "../utils/auth.utils.js";
import {
  sendForgotPasswordEmail,
  sendVerificationEmail,
} from "../services/emailService.js";

// REGISTER USER
export const register = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body ?? {};

    // Validate required fields
    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string" ||
      !name.trim() ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "Name, email, and password are required",
      });
    }

    // Validate name length
    if (name.trim().length > 50) {
      return res.status(400).json({
        success: false,
        message: "Name cannot exceed 50 characters",
      });
    }

    // Normalize and validate email
    const normalizedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address",
      });
    }

    if (normalizedEmail.length > 254) {
      return res.status(400).json({
        success: false,
        message: "Email address is too long",
      });
    }

    // Validate password
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters",
      });
    }

    if (Buffer.byteLength(password, "utf8") > 72) {
      return res.status(400).json({
        success: false,
        message: "Password must not exceed 72 UTF-8 bytes",
      });
    }

    // Validate optional phone field
    if (phone !== undefined && phone !== null && typeof phone !== "string") {
      return res.status(400).json({
        success: false,
        message: "Phone must be a string",
      });
    }

    // Check authentication configuration
    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is not configured");

      return res.status(500).json({
        success: false,
        message: "Authentication is not configured",
      });
    }

    // Check for existing account
    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    //to generate 6 digit OTP

    const verificationOTP = crypto.randomInt(100000, 1000000).toString();

    const verificationOTPExpires = Date.now() + 10 * 60 * 1000; //10mins

    // Create customer account.
    // Never accept role from the request body.
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      ...(phone !== undefined && { phone: phone.trim() }),
      role: "customer",
      verificationOTP: hashOtp(verificationOTP),
      verificationOTPExpires,
    });

    // to send the verification email
    try {
      await sendVerificationEmail(
        normalizedEmail,
        name.trim(),
        verificationOTP,
      );
    } catch (error) {
      console.error("Failed to send verification email:", error);
      await User.deleteOne({ _id: user._id });
      return res.status(500).json({
        success: false,
        message:
          "Account created, but failed to send verification email. Please try again later.",
      });
    }

    return res.status(201).json({
      success: true,
      message:
        "Account created successfully! Please check your email for the 6-digit verification code",
      user: toPublicUser(user),
      isVerified: false,
    });
  } catch (error) {
    // Duplicate key error
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    // Mongoose validation error
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Invalid user data",
      });
    }

    console.error("Registration failed:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to create account",
    });
  }
};

// LOGIN USER
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    // Validate email format
    const normalizedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (normalizedEmail.length > 254 || !emailRegex.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address",
      });
    }

    // Find user and explicitly select password
    const user = await User.findOne({
      email: normalizedEmail,
    }).select("+password +authTokenVersion");
    // Use the same response for incorrect email or password
    if (
      !user ||
      typeof user.password !== "string" ||
      !(await bcrypt.compare(password, user.password))
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Check account status
    if (user.isActive === false) {
      return res.status(403).json({
        success: false,
        message: "This account is inactive",
      });
    }

    if (!user.isVerified) {
      return res.status(403).json({
        success: false,
        code: "EMAIL_NOT_VERIFIED",
        message: "Verify your email before logging in",
      });
    }

    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is not configured");

      return res.status(500).json({
        success: false,
        message: "Authentication is not configured",
      });
    }

    const token = createToken(user._id.toString(), user.authTokenVersion);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: toPublicUser(user),
      isVerified:true
    });
  } catch (error) {
    console.error("Login failed:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to log in",
    });
  }
};

// GET CURRENT LOGGED-IN USER
export const getCurrentUser = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    return res.status(200).json({
      success: true,
      user: toPublicUser(req.user),
    });
  } catch (error) {
    console.error("Fetching current user failed:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch user",
    });
  }
};

// verify-email

export const verifyEmail = async (req, res) => {
  try {
    const { email, otp } = req.body ?? {};

    if (
      typeof email !== "string" ||
      !email.trim() ||
      email.trim().length > 254 ||
      typeof otp !== "string" ||
      !/^\d{6}$/.test(otp)
    ) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOneAndUpdate(
      {
        email: normalizedEmail,
        verificationOTP: hashOtp(otp),
        verificationOTPExpires: { $gt: new Date() },
      },
      {
        $set: { isVerified: true },
        $unset: { verificationOTP: 1, verificationOTPExpires: 1 },
      },
      { new: true, runValidators: true },
    );

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Email verified successfully! You can now log in.",
    });
  } catch (error) {
    console.error("Email verification failed:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to verify email",
    });
  }
};

// if use has forgot the password

export const forgotPassword = async (req, res) => {
  try {
    const email =
      typeof req.body?.email === "string"
        ? req.body.email.trim().toLowerCase()
        : "";

    if (!email || email.length > 254) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const user = await User.findOne({ email, isActive: true });
    if (!user) {
      return res.status(200).json({
        success: true,
        message: "If an account exists, a password reset code has been sent.",
      });
    }

    const resetOTP = crypto.randomInt(100000, 1000000).toString();
    const resetOTPExpires = Date.now() + 10 * 60 * 1000;

    user.resetPasswordOTP = hashOtp(resetOTP);
    user.resetPasswordOTPExpires = resetOTPExpires;
    await user.save();

    try {
      await sendForgotPasswordEmail(email, user.name, resetOTP);
    } catch (error) {
      user.resetPasswordOTP = undefined;
      user.resetPasswordOTPExpires = undefined;
      await user.save();
      throw error;
    }

    return res.status(200).json({
      success: true,
      message: "If an account exists, a password reset code has been sent.",
    });
  } catch (error) {
    console.error("Password reset email failed:", error);
    return res.status(200).json({
      success: true,
      message: "If an account exists, a password reset code has been sent.",
    });
  }
};

// Reset password

export const resetPassword = async (req, res) => {
  try {
    const email =
      typeof req.body?.email === "string"
        ? req.body.email.trim().toLowerCase()
        : "";
    const { otp, password } = req.body ?? {};

    if (
      !email ||
      email.length > 254 ||
      typeof otp !== "string" ||
      !/^\d{6}$/.test(otp) ||
      typeof password !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Email, reset code, and new password are required",
      });
    }
    if (password.length < 8 || Buffer.byteLength(password, "utf8") > 72) {
      return res.status(400).json({
        success: false,
        message: "Password must be 8 to 72 UTF-8 bytes",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await User.findOneAndUpdate(
      {
        email,
        resetPasswordOTP: hashOtp(otp),
        resetPasswordOTPExpires: { $gt: new Date() },
      },
      {
        $set: { password: hashedPassword },
        $inc: { authTokenVersion: 1 },
        $unset: { resetPasswordOTP: 1, resetPasswordOTPExpires: 1 },
      },
      { new: true, runValidators: true },
    );

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset code",
      });
    }

    return res.status(200).json({
      success: true,
      message:
        "Password reset successfully. Please log in with your new password.",
    });
  } catch (error) {
    console.error("Password reset failed:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to reset password",
    });
  }
};