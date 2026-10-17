import Product from "../models/product.model.js";
import Category from "../models/category.model.js";
import isValidObjectId from "../utils/validateObjectId.js";
import handleError from "../utils/handleError.js";
import {
  uploadImages,
  deleteCloudinaryImages,
} from "../utils/cloudinary.upload.js";

// Helper to prevent Number(""), Number("  "), Number(null), or Number(false) from evaluating to 0
const isValidNumber = (val) =>
  (typeof val === "number" || (typeof val === "string" && val.trim() !== "")) &&
  Number.isFinite(Number(val));


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

    // 6. Upload images to Cloudinary
    uploadedImages = await uploadImages(req.files ?? []);

    // 7. Create the product in MongoDB
    const product = await Product.create({
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
    });

    return res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: product,
    });
  } catch (error) {
    // 8. Remove uploaded images if product creation fails
    await deleteCloudinaryImages(uploadedImages);

    return handleError(res, error, "Failed to create product");
  }
};


// GET ALL PRODUCTS
export const getProducts = async (req, res) => {
  try {
    const {
      search,
      category,
      minPrice,
      maxPrice,
      page = 1,
      limit = 12,
      sort = "newest",
    } = req.query;

    const pageNumber = Number(page);
    const limitNumber = Number(limit);

    if (
      !isValidNumber(page) ||
      !isValidNumber(limit) ||
      !Number.isInteger(pageNumber) ||
      !Number.isInteger(limitNumber) ||
      pageNumber < 1 ||
      limitNumber < 1 ||
      limitNumber > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid page or limit",
      });
    }

    const filter = { isActive: true };

    if (search?.trim()) {
      const escapedSearch = search
        .trim()
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      filter.name = {
        $regex: escapedSearch,
        $options: "i",
      };
    }

    if (category && category.trim() !== "") {
      if (!isValidObjectId(category)) {
        return res.status(400).json({
          success: false,
          message: "Invalid category ID",
        });
      }

      filter.category = category;
    }

    const hasMinPrice = minPrice !== undefined && minPrice.trim() !== "";
    const hasMaxPrice = maxPrice !== undefined && maxPrice.trim() !== "";

    if (hasMinPrice || hasMaxPrice) {
      const priceFilter = {};

      if (hasMinPrice) {
        if (!isValidNumber(minPrice) || Number(minPrice) < 0) {
          return res.status(400).json({
            success: false,
            message: "Invalid minimum price",
          });
        }
        priceFilter.$gte = Number(minPrice);
      }

      if (hasMaxPrice) {
        if (!isValidNumber(maxPrice) || Number(maxPrice) < 0) {
          return res.status(400).json({
            success: false,
            message: "Invalid maximum price",
          });
        }
        priceFilter.$lte = Number(maxPrice);
      }

      if (
        priceFilter.$gte !== undefined &&
        priceFilter.$lte !== undefined &&
        priceFilter.$gte > priceFilter.$lte
      ) {
        return res.status(400).json({
          success: false,
          message: "Minimum price cannot be greater than maximum price",
        });
      }

      filter.price = priceFilter;
    }

    const sortOptions = {
      newest: { createdAt: -1 },
      price_asc: { price: 1 },
      price_desc: { price: -1 },
      name_asc: { name: 1 },
    };

    if (!sortOptions[sort]) {
      return res.status(400).json({
        success: false,
        message: "Invalid sort option",
      });
    }

    const skip = (pageNumber - 1) * limitNumber;

    const [products, total] = await Promise.all([
      Product.find(filter)
        .populate("category", "name slug")
        .sort(sortOptions[sort])
        .skip(skip)
        .limit(limitNumber)
        .lean(),
      Product.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      count: products.length,
      total,
      page: pageNumber,
      totalPages: Math.ceil(total / limitNumber),
      data: products,
    });
  } catch (error) {
    return handleError(res, error, "Failed to fetch products");
  }
};

// GET SINGLE PRODUCT
export const getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    const product = await Product.findOne({
      _id: id,
      isActive: true,
    })
      .populate("category", "name slug")
      .lean();

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error) {
    return handleError(res, error, "Failed to fetch product");
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
    };

    for (const key of Object.keys(updates)) {
      if (updates[key] === undefined) {
        delete updates[key];
      }
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
    const existingProduct = await Product.findById(id).select("images").lean();

    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Upload new images only when files are provided.
    if (hasNewImages) {
      newlyUploadedImages = await uploadImages(req.files);
      updates.images = newlyUploadedImages;
    }

    // Update MongoDB.
    const product = await Product.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    })
      .populate("category", "name slug")
      .lean();

    if (!product) {
      await deleteCloudinaryImages(newlyUploadedImages);
      newlyUploadedImages = [];

      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Delete old Cloudinary images only after the DB update succeeds.
    if (hasNewImages) {
      await deleteCloudinaryImages(existingProduct.images ?? []);

      newlyUploadedImages = [];
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
