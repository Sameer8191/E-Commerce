import mongoose from "mongoose";
import { USER_ROLES } from "../config/admin-permissions.js";

const addressSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
    },

    street: {
      type: String,
      required: true,
      trim: true,
    },
    street2: { type: String, trim: true, maxlength: 200, default: "" },

    city: {
      type: String,
      required: true,
      trim: true,
    },

    state: {
      type: String,
      required: true,
      trim: true,
    },

    postalCode: {
      type: String,
      required: true,
      trim: true,
    },

    country: {
      type: String,
      required: true,
      default: "India",
    },

    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  { _id: true },
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 50,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Please provide a valid email address",
      ],
    },

    password: {
      type: String,
      required: true,
      minlength: 8,
      select: false,
    },

    phone: {
      type: String,
      trim: true,
    },

    avatar: {
      type: String,
      default: "",
    },

    role: {
      type: String,
      enum: USER_ROLES,
      default: "customer",
    },

    addresses: {
      type: [addressSchema],
      default: [],
    },

    isActive: {
      type: Boolean,
      default: true,
    },
    authTokenVersion: {
      type: Number,
      default: 0,
      min: 0,
      validate: Number.isSafeInteger,
      select: false,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    verificationOTP: { type: String, select: false },
    verificationOTPExpires: { type: Date, select: false },
    pendingEmail: { type: String, lowercase: true, trim: true, select: false },
    emailChangeOTP: { type: String, select: false },
    emailChangeOTPExpires: { type: Date, select: false },
    resetPasswordOTP: { type: String, select: false },
    resetPasswordOTPExpires: { type: Date, select: false },
  },

  {
    timestamps: true,
  },
);

userSchema
  .path("addresses")
  .validate(
    (addresses) => addresses.filter((address) => address.isDefault).length <= 1,
    "Only one address can be marked as default",
  );

const User = mongoose.model("User", userSchema);

export default User;
