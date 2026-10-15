
import mongoose from "mongoose";
import Category from "../models/category.model.js";

// Reusable helpers

const isValidObjectId = (id) =>
  typeof id === "string" &&
  mongoose.isObjectIdOrHexString(id);

const handleError = (res, error, message) => {
  console.error(message, error);

  if (error.code === 11000) {
    return res.status(409).json({
      success: false,
      message: "Category name or slug already exists",
    });
  }

  if (error.name === "ValidationError" || error.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: "Invalid category data",
    });
  }

  return res.status(500).json({
    success: false,
    message,
  });
};

// CREATE CATEGORY
export const createCategory = async (req, res) => {
  try {
    const { name, slug, description, image } = req.body;

    const normalizedName =
      typeof name === "string" ? name.trim() : "";

    const normalizedSlug =
      typeof slug === "string" ? slug.trim().toLowerCase() : "";

    if (!normalizedName || !normalizedSlug) {
      return res.status(400).json({
        success: false,
        message: "Name and slug are required",
      });
    }

    if (normalizedName.length > 100 || normalizedSlug.length > 120) {
      return res.status(400).json({
        success: false,
        message: "Name or slug exceeds the allowed length",
      });
    }

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalizedSlug)) {
      return res.status(400).json({
        success: false,
        message: "Slug must contain lowercase letters, numbers, and hyphens",
      });
    }

    const category = await Category.create({
      name: normalizedName,
      slug: normalizedSlug,
      description,
      image,
    });

    return res.status(201).json({
      success: true,
      message: "Category created successfully",
      data: category,
    });
  } catch (error) {
    return handleError(res, error, "Failed to create category");
  }
};

// GET ALL ACTIVE CATEGORIES (PAGINATED)
export const getCategories = async (req, res) => {
  try {
    const parsedPage = Number(req.query.page ?? 1);
    const parsedLimit = Number(req.query.limit ?? 20);

    if (
      !Number.isInteger(parsedPage) ||
      !Number.isInteger(parsedLimit) ||
      parsedPage < 1 ||
      parsedLimit < 1
    ) {
      return res.status(400).json({
        success: false,
        message: "Page and limit must be positive integers",
      });
    }

    const page = parsedPage;
    const limit = Math.min(parsedLimit, 100);
    const skip = (page - 1) * limit;

    const [categories, total] = await Promise.all([
      Category.find({ isActive: true })
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Category.countDocuments({ isActive: true }),
    ]);

    return res.status(200).json({
      success: true,
      data: categories,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return handleError(res, error, "Failed to fetch categories");
  }
};

// GET SINGLE ACTIVE CATEGORY
export const getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID",
      });
    }

    const category = await Category.findOne({
      _id: id,
      isActive: true,
    }).lean();

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: category,
    });
  } catch (error) {
    return handleError(res, error, "Failed to fetch category");
  }
};

// UPDATE ACTIVE CATEGORY
export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, slug, description, image } = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID",
      });
    }

    const updates = {};

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: "Name must be a non-empty string",
        });
      }

      if (name.trim().length > 100) {
        return res.status(400).json({
          success: false,
          message: "Name cannot exceed 100 characters",
        });
      }

      updates.name = name.trim();
    }

    if (slug !== undefined) {
      if (
        typeof slug !== "string" ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(
          slug.trim().toLowerCase()
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid slug format",
        });
      }

      if (slug.trim().length > 120) {
        return res.status(400).json({
          success: false,
          message: "Slug cannot exceed 120 characters",
        });
      }

      updates.slug = slug.trim().toLowerCase();
    }

    if (description !== undefined) {
      if (typeof description !== "string") {
        return res.status(400).json({
          success: false,
          message: "Description must be a string",
        });
      }

      updates.description = description.trim();
    }

    if (image !== undefined) {
      if (typeof image !== "string") {
        return res.status(400).json({
          success: false,
          message: "Image must be a string",
        });
      }

      updates.image = image.trim();
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields provided for update",
      });
    }

    const category = await Category.findOneAndUpdate(
      { _id: id, isActive: true },
      { $set: updates },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Active category not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Category updated successfully",
      data: category,
    });
  } catch (error) {
    return handleError(res, error, "Failed to update category");
  }
};

// SOFT DELETE CATEGORY
export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID",
      });
    }

    const category = await Category.findOneAndUpdate(
      { _id: id, isActive: true },
      { $set: { isActive: false } },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Active category not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Category deactivated successfully",
      data: {
        id: category._id,
        isActive: category.isActive,
      },
    });
  } catch (error) {
    return handleError(res, error, "Failed to deactivate category");
  }
};
