
import mongoose from "mongoose";
import User from "../models/user.model.js";
import AdminActivity from "../models/admin-activity.model.js";
import { STAFF_ROLES, getPermissionsForRole } from "../config/admin-permissions.js";
import { validAddress, normalizeAddress } from "../utils/order.utils.js";

const addressFieldsToUserShape = (address) => ({
  fullName: address.fullName,
  phone: address.phone,
  street: address.addressLine1,
  street2: address.addressLine2 || "",
  city: address.city,
  state: address.state,
  postalCode: address.postalCode,
  country: address.country || "India",
  isDefault: Boolean(address.isDefault),
});

export const addMyAddress = async (req, res) => {
  try {
    const address = req.body?.address;
    if (address?.isDefault !== undefined && typeof address.isDefault !== "boolean") {
      return res.status(400).json({ success: false, message: "Default address selection must be true or false." });
    }
    if (!validAddress(address)) return res.status(400).json({ success: false, message: "Provide a valid delivery address." });
    const user = await User.findOne({ _id: req.user.userId, isActive: true });
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    if (user.addresses.length >= 20) return res.status(400).json({ success: false, message: "You can save up to 20 addresses." });
    const makeDefault = Boolean(address.isDefault) || user.addresses.length === 0;
    if (makeDefault) user.addresses.forEach((item) => { item.isDefault = false; });
    user.addresses.push(addressFieldsToUserShape({ ...normalizeAddress(address), isDefault: makeDefault }));
    await user.save();
    return res.status(201).json({ success: true, data: user.addresses.at(-1) });
  } catch (error) {
    console.error("Add saved address error:", error);
    return res.status(500).json({ success: false, message: "Could not save this address." });
  }
};

export const updateMyAddress = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.addressId)) return res.status(400).json({ success: false, message: "Invalid address ID." });
    const address = req.body?.address;
    if (address?.isDefault !== undefined && typeof address.isDefault !== "boolean") {
      return res.status(400).json({ success: false, message: "Default address selection must be true or false." });
    }
    if (!validAddress(address)) return res.status(400).json({ success: false, message: "Provide a valid delivery address." });
    const user = await User.findOne({ _id: req.user.userId, isActive: true });
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    const target = user.addresses.id(req.params.addressId);
    if (!target) return res.status(404).json({ success: false, message: "Saved address not found." });
    const makeDefault = Boolean(address.isDefault);
    if (makeDefault) user.addresses.forEach((item) => { item.isDefault = false; });
    Object.assign(target, addressFieldsToUserShape({ ...normalizeAddress(address), isDefault: makeDefault }));
    await user.save();
    return res.json({ success: true, data: target });
  } catch (error) {
    console.error("Update saved address error:", error);
    return res.status(500).json({ success: false, message: "Could not update this address." });
  }
};

export const deleteMyAddress = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.addressId)) return res.status(400).json({ success: false, message: "Invalid address ID." });
    const user = await User.findOne({ _id: req.user.userId, isActive: true });
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    const target = user.addresses.id(req.params.addressId);
    if (!target) return res.status(404).json({ success: false, message: "Saved address not found." });
    const wasDefault = target.isDefault;
    target.deleteOne();
    if (wasDefault && user.addresses.length) user.addresses[0].isDefault = true;
    await user.save();
    return res.json({ success: true, message: "Address removed." });
  } catch (error) {
    console.error("Delete saved address error:", error);
    return res.status(500).json({ success: false, message: "Could not remove this address." });
  }
};


// GET MY PROFILE
export const getMyProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId)
      .select("name email phone avatar role addresses isActive isVerified createdAt updatedAt");

    if (!user || !user.isActive) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      user: {
        ...user.toObject(),
        permissions: getPermissionsForRole(user.role),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch profile",
    });
  }
};

// UPDATE MY PROFILE
export const updateMyProfile = async (req, res) => {
  try {
    const { name, phone, avatar } = req.body;

    const user = await User.findById(req.user.userId);

    if (!user || !user.isActive) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: "Name cannot be empty",
        });
      }

      user.name = name.trim();
    }

    if (phone !== undefined) {
      if (typeof phone !== "string") {
        return res.status(400).json({
          success: false,
          message: "Invalid phone number",
        });
      }

      user.phone = phone.trim();
    }

    if (avatar !== undefined) {
      if (typeof avatar !== "string") {
        return res.status(400).json({
          success: false,
          message: "Invalid avatar",
        });
      }

      user.avatar = avatar.trim();
    }

    await user.save();

    const safeUser = {
      id: user._id.toString(), name: user.name, email: user.email,
      phone: user.phone, avatar: user.avatar, role: user.role,
      permissions: getPermissionsForRole(user.role),
      addresses: user.addresses, isActive: user.isActive,
      isVerified: user.isVerified, createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: safeUser,
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update profile",
    });
  }
};

// GET ALL USERS (ADMIN)
export const getAllUsers = async (req, res) => {
  try {
    const {
      search = "",
      role,
      page = 1,
      limit = 10,
      sort = "newest",
    } = req.query;

    const pageNumber = Number(page);
    const limitNumber = Number(limit);

    if (
      !Number.isSafeInteger(pageNumber) ||
      pageNumber < 1 ||
      !Number.isSafeInteger(limitNumber) ||
      limitNumber < 1 ||
      limitNumber > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid pagination values",
      });
    }

    const filter = role === undefined ? { role: "customer" } : {};

    if (role !== undefined) {
      if (role !== "customer") {
        return res.status(400).json({
          success: false,
          message: "Customer directory only supports the customer role",
        });
      }
      filter.role = role;
    }

    if (typeof search !== "string") {
      return res.status(400).json({
        success: false,
        message: "Invalid search query",
      });
    }

    if (search.trim()) {
      const escapedSearch = search.trim().replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

      filter.$or = [
        { name: { $regex: escapedSearch, $options: "i" } },
        { email: { $regex: escapedSearch, $options: "i" } },
      ];
    }

    const sortOptions = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      name: { name: 1 },
    };

    if (!sortOptions[sort]) {
      return res.status(400).json({
        success: false,
        message: "Invalid sort option",
      });
    }

    const skip = (pageNumber - 1) * limitNumber;
    if (!Number.isSafeInteger(skip)) {
      return res.status(400).json({
        success: false,
        message: "Invalid pagination values",
      });
    }

    const [users, totalUsers] = await Promise.all([
      User.find(filter)
        .select("name email phone avatar role addresses isActive isVerified createdAt updatedAt")
        .sort(sortOptions[sort])
        .skip(skip)
        .limit(limitNumber)
        .lean(),
      User.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      users,
      pagination: {
        totalUsers,
        currentPage: pageNumber,
        totalPages: Math.ceil(totalUsers / limitNumber),
        limit: limitNumber,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch users",
    });
  }
};

// GET USER BY ID (ADMIN)
export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    const user = await User.findOne({ _id: id, role: "customer" }).select("name email phone avatar role addresses isActive isVerified createdAt updatedAt");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch user",
    });
  }
};

export const getAdminStaff = async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 50);
    if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
      return res.status(400).json({ success: false, message: "Invalid pagination values" });
    }
    const filter = { role: { $in: ["customer", ...STAFF_ROLES] } };
    const [users, total] = await Promise.all([
      User.find(filter)
        .select("name email role isActive isVerified createdAt updatedAt")
        .sort({ role: 1, name: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);
    return res.json({
      success: true,
      data: users.map((user) => ({
        ...user,
        permissions: getPermissionsForRole(user.role),
      })),
      roles: [...STAFF_ROLES, "customer"],
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Get admin staff error:", error);
    return res.status(500).json({ success: false, message: "Could not load staff access" });
  }
};
// UPDATE USER ROLE (ADMIN)
export const updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    if (!["customer", ...STAFF_ROLES].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Choose a valid customer or staff role",
      });
    }

    // Prevent an admin from changing their own role.
    if (id === req.user.userId) {
      return res.status(400).json({
        success: false,
        message: "You cannot change your own role",
      });
    }

    const target = await User.findOne({ _id: id, isActive: true }).select("role").lean();
    if (!target) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    if (target.role === "admin" && role !== "admin") {
      const activeOwnerCount = await User.countDocuments({ role: "admin", isActive: true });
      if (activeOwnerCount <= 1) {
        return res.status(409).json({ success: false, message: "The last active owner account cannot be demoted" });
      }
    }
    const user = await User.findOneAndUpdate(
      { _id: id, isActive: true, role: target.role },
      { $set: { role }, $inc: { authTokenVersion: 1 } },
      { new: true, runValidators: true },
    ).select("name email phone avatar role addresses isActive isVerified createdAt updatedAt").lean();

    if (!user) {
      return res.status(409).json({
        success: false,
        message: "User role changed concurrently. Refresh and try again.",
      });
    }

    try {
      await AdminActivity.create({
        actor: req.user.userId,
        action: "staff_role_updated",
        entityType: "user",
        entityId: id,
        summary: `${user.name} role changed from ${target.role} to ${role}`,
        metadata: { previousRole: target.role, role },
      });
    } catch (auditError) {
      console.error("Staff role audit log failed:", auditError);
    }

    return res.status(200).json({
      success: true,
      message: "Staff access updated successfully",
      user: { ...user, permissions: getPermissionsForRole(user.role) },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update user role",
    });
  }
};

// SOFT DELETE USER (ADMIN)
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    if (id === req.user.userId) {
      return res.status(400).json({
        success: false,
        message: "You cannot deactivate your own account",
      });
    }

    const user = await User.findOneAndUpdate(
      { _id: id, isActive: true, role: "customer" },
      { $set: { isActive: false }, $inc: { authTokenVersion: 1 } },
      { new: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "User deactivated successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to deactivate user",
    });
  }
};
