import Product from "../models/product.model.js";
import Category from "../models/category.model.js";
import isValidObjectId from "../utils/validateObjectId.js";
import handleError from "../utils/handleError.js";
import { notifyStockRestock } from "./storefront.controller.js";
import { uploadImages, deleteCloudinaryImages } from "../utils/cloudinary.upload.js";
import { isValidNumber } from "../utils/number.utils.js";
import AdminActivity from "../models/admin-activity.model.js";
import Vendor from "../models/vendor.model.js";

const parseVariants = (value) => {
  if (value === undefined || value === null || value === "") return [];
  const entries = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : null;
  if (!entries || entries.length > 20 || entries.some((item) => typeof item !== "string" || !item.trim() || item.trim().length > 80)) return null;
  const normalized = entries.map((item) => item.trim());
  return [...new Set(normalized)];
};

const logProductAdminActivity = async (req, action, product) => {
  if (req.user?.role !== "admin") return;
  try {
    await AdminActivity.create({ actor: req.user.userId, action, entityType: "product", entityId: String(product._id), summary: `${product.name} ${action.replace("product_", "")}` });
  } catch (error) {
    console.error("Product activity log failed:", error);
  }
};
export const createProduct = async (req, res) => {
  let uploadedImages = [];

  try {
    const {
      name,
      description,
      price,
      compareAtPrice,
      category,
      brand,
      stock,
      sku,
      variants,
    } = req.body;

    // 1. Validate required fields
    if (
      typeof name !== "string" ||
      !name.trim() ||
      typeof description !== "string" ||
      !description.trim() ||
      price === undefined ||
      price === "" ||
      !category ||
      typeof sku !== "string" ||
      !sku.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Required product fields are missing",
      });
    }

    // 2. Validate price, stock, and category ID
    if (
      !isValidObjectId(category) ||
      !isValidNumber(price) ||
      Number(price) < 0 ||
      (stock !== undefined &&
        stock !== "" &&
        (!isValidNumber(stock) ||
          !Number.isInteger(Number(stock)) ||
          Number(stock) < 0))
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid category, price, or stock",
      });
    }

    // 3. Validate compare-at price
    if (
      compareAtPrice !== undefined &&
      compareAtPrice !== null &&
      compareAtPrice !== "" &&
      (!isValidNumber(compareAtPrice) ||
        Number(compareAtPrice) < Number(price))
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Compare-at price must be a valid number greater than or equal to price",
      });
    }

    // 4. Validate optional brand
    if (brand !== undefined && typeof brand !== "string") {
      return res.status(400).json({
        success: false,
        message: "Brand must be a string",
      });
    }
    const normalizedVariants = parseVariants(variants);
    if (!normalizedVariants) return res.status(400).json({ success: false, message: "Options must be up to 20 unique comma-separated values, each 80 characters or fewer." });

    // 5. Verify that the category exists and is active
    const categoryExists = await Category.exists({
      _id: category,
      isActive: true,
    });

    if (!categoryExists) {
      return res.status(400).json({
        success: false,
        message: "Active category not found",
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one product image is required",
      });
    }

    // 6. Upload images to Cloudinary
    uploadedImages = await uploadImages(req.files);

    // 7. Create the product in MongoDB
    const vendor = req.vendor || await Vendor.findOne({ isPlatform: true, status: "approved" }).select("_id");
    if (!vendor) {
      return res.status(409).json({
        success: false,
        message: "Set up the platform store and migrate existing products before adding products.",
      });
    }

    const product = await Product.create({
      vendor: vendor._id,
      name: name.trim(),
      description: description.trim(),
      price: Number(price),
      compareAtPrice:
        compareAtPrice === undefined ||
        compareAtPrice === null ||
        compareAtPrice === ""
          ? null
          : Number(compareAtPrice),
      images: uploadedImages,
      category,
      brand: brand?.trim() || "",
      stock:
        stock === undefined || stock === ""
          ? 0
          : Number(stock),
      sku: sku.trim(),
      variants: normalizedVariants,
    });
    await logProductAdminActivity(req, "product_created", product);

    return res.status(201).json({
      success: true,
      message: "Product created successfully",
      productId: product._id,
      data: product,
    });
  } catch (error) {
    // 8. Remove uploaded images if product creation fails
    await deleteCloudinaryImages(uploadedImages);

    return handleError(res, error, "Failed to create product");
  }
};


// UPDATE PRODUCT
export const updateProduct = async (req, res) => {
  let newlyUploadedImages = [];

  try {
    const { id } = req.params;

    const {
      name,
      description,
      price,
      compareAtPrice,
      category,
      brand,
      stock,
      sku,
      isActive,
      variants,
    } = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    const updates = {
      name,
      description,
      price,
      compareAtPrice,
      category,
      brand,
      stock,
      sku,
      isActive,
      variants,
    };

    for (const key of Object.keys(updates)) {
      if (updates[key] === undefined) {
        delete updates[key];
      }
    }
    if (updates.variants !== undefined) {
      const normalizedVariants = parseVariants(updates.variants);
      if (!normalizedVariants) return res.status(400).json({ success: false, message: "Options must be up to 20 unique comma-separated values, each 80 characters or fewer." });
      updates.variants = normalizedVariants;
    }

    const hasNewImages = (req.files?.length ?? 0) > 0;

    if (Object.keys(updates).length === 0 && !hasNewImages) {
      return res.status(400).json({
        success: false,
        message: "No fields provided for update",
      });
    }

    // Validate string fields.
    for (const field of ["name", "description", "sku"]) {
      if (updates[field] !== undefined) {
        if (typeof updates[field] !== "string" || !updates[field].trim()) {
          return res.status(400).json({
            success: false,
            message: `${field} must be a non-empty string`,
          });
        }

        updates[field] = updates[field].trim();
      }
    }

    if (updates.brand !== undefined) {
      if (typeof updates.brand !== "string") {
        return res.status(400).json({
          success: false,
          message: "Brand must be a string",
        });
      }

      updates.brand = updates.brand.trim();
    }

    // Validate category.
    if (updates.category !== undefined) {
      if (!isValidObjectId(updates.category)) {
        return res.status(400).json({
          success: false,
          message: "Invalid category ID",
        });
      }

      const categoryExists = await Category.exists({
        _id: updates.category,
        isActive: true,
      });

      if (!categoryExists) {
        return res.status(400).json({
          success: false,
          message: "Active category not found",
        });
      }
    }

    // Validate price.
    if (updates.price !== undefined) {
      if (!isValidNumber(updates.price) || Number(updates.price) < 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid price",
        });
      }

      updates.price = Number(updates.price);
    }

    // Validate stock.
    if (updates.stock !== undefined) {
      if (
        !isValidNumber(updates.stock) ||
        !Number.isInteger(Number(updates.stock)) ||
        Number(updates.stock) < 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid stock",
        });
      }

      updates.stock = Number(updates.stock);
    }

    // Validate compare-at price.
    if (updates.compareAtPrice !== undefined) {
      if (updates.compareAtPrice === null || updates.compareAtPrice === "") {
        updates.compareAtPrice = null;
      } else if (
        !isValidNumber(updates.compareAtPrice) ||
        Number(updates.compareAtPrice) < 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid compare-at price",
        });
      } else {
        updates.compareAtPrice = Number(updates.compareAtPrice);
      }
    }

    // Validate isActive if provided.
    if (
      updates.isActive !== undefined &&
      typeof updates.isActive !== "boolean" &&
      !["true", "false"].includes(updates.isActive)
    ) {
      return res.status(400).json({
        success: false,
        message: "isActive must be a boolean",
      });
    }

    if (updates.isActive === "true") updates.isActive = true;
    if (updates.isActive === "false") updates.isActive = false;

    // Load existing images before replacing them.
    const productScope = req.vendor ? { vendor: req.vendor._id } : {};
    const existingProduct = await Product.findOne({ _id: id, isDeleted: false, ...productScope }).select("images price compareAtPrice").lean();

    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const effectivePrice =
      updates.price === undefined ? existingProduct.price : updates.price;
    const effectiveCompareAtPrice =
      updates.compareAtPrice === undefined
        ? existingProduct.compareAtPrice
        : updates.compareAtPrice;
    if (
      effectiveCompareAtPrice !== null &&
      effectiveCompareAtPrice !== undefined &&
      effectiveCompareAtPrice < effectivePrice
    ) {
      return res.status(400).json({
        success: false,
        message: "Compare-at price must be greater than or equal to price",
      });
    }

    // Upload new images only when files are provided.
    if (hasNewImages) {
      newlyUploadedImages = await uploadImages(req.files);
      updates.images = newlyUploadedImages;
    }

    // Update MongoDB.
    const updateFilter = { _id: id, isDeleted: false, ...productScope };
    const updatesPriceFields =
      updates.price !== undefined || updates.compareAtPrice !== undefined;
    if (updatesPriceFields) {
      updateFilter.price = existingProduct.price;
      updateFilter.compareAtPrice = existingProduct.compareAtPrice ?? null;
    }

    const product = await Product.findOneAndUpdate(
      updateFilter,
      updates,
      { new: true, runValidators: true },
    )
      .populate("category", "name slug")
      .lean();

    if (!product) {
      await deleteCloudinaryImages(newlyUploadedImages);
      newlyUploadedImages = [];

      if (
        updatesPriceFields &&
        (await Product.exists({ _id: id, isDeleted: false, ...productScope }))
      ) {
        return res.status(409).json({
          success: false,
          message: "Product price changed during update; please retry",
        });
      }
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    await logProductAdminActivity(req, "product_updated", product);
    if (Number(existingProduct.stock) <= 0 && Number(product.stock) > 0) {
      void notifyStockRestock(product).catch((error) => console.error("Stock alert delivery failed:", error));
    }

    // Delete old Cloudinary images only after the DB update succeeds.
    if (hasNewImages) {
      const cleanup = await deleteCloudinaryImages(existingProduct.images ?? []);
      newlyUploadedImages = [];
      if (cleanup.queued.length || cleanup.unqueued.length) {
        return res.status(200).json({
          success: true,
          message: "Product updated successfully",
          data: product,
          ...(cleanup.queued.length > 0 && {
            cleanupPending: true,
            cleanupMessage: "Old images are queued for background cleanup",
          }),
          ...(cleanup.unqueued.length > 0 && {
            cleanupQueueFailed: true,
            cleanupWarning: "Some old images could not be queued for cleanup and may need manual removal",
          }),
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: product,
    });
  } catch (error) {
    // Roll back newly uploaded images if the update fails.
    await deleteCloudinaryImages(newlyUploadedImages);

    return handleError(res, error, "Failed to update product");
  }
};

// Delete Product


export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    const product = await Product.findOneAndUpdate(
      {
        _id: id,
        isDeleted: false,
        ...(req.vendor && { vendor: req.vendor._id }),
      },
      {
        $set: {
          isActive: false,
          isDeleted: true,
          deletedAt: new Date(),
        },
      },
      {
        new: true,
        runValidators: true,
      }
    ).select("_id isActive isDeleted deletedAt");

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found or already deleted",
      });
    }

    await logProductAdminActivity(req, "product_deleted", product);

    return res.status(200).json({
      success: true,
      message: "Product deleted successfully",
      data: {
        id: product._id,
        isActive: product.isActive,
        isDeleted: product.isDeleted,
        deletedAt: product.deletedAt,
      },
    });
  } catch (error) {
    return handleError(res, error, "Failed to delete product");
  }
};
