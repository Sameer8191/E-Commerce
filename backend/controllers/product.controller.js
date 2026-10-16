import Product from "../models/product.model.js";
import Category from "../models/category.model.js";
import isValidObjectId from "../utils/validateObjectId.js";
import handleError from "../utils/handleError.js";

// Helper to prevent Number(""), Number("  "), Number(null), or Number(false) from evaluating to 0
const isValidNumber = (val) =>
  (typeof val === "number" || (typeof val === "string" && val.trim() !== "")) &&
  Number.isFinite(Number(val));

// CREATE PRODUCT
export const createProduct = async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      compareAtPrice,
      images,
      category,
      brand,
      stock,
      sku,
    } = req.body;

    if (
      !name?.trim() ||
      !description?.trim() ||
      price === undefined ||
      !category ||
      !sku?.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Required product fields are missing",
      });
    }

    if (
      !isValidObjectId(category) ||
      !isValidNumber(price) ||
      Number(price) < 0 ||
      (stock !== undefined &&
        (!isValidNumber(stock) ||
          !Number.isInteger(Number(stock)) ||
          Number(stock) < 0))
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid category, price, or stock",
      });
    }

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

    if (
      images !== undefined &&
      (!Array.isArray(images) ||
        images.some((img) => typeof img !== "string" || !img.trim()))
    ) {
      return res.status(400).json({
        success: false,
        message: "Images must be an array of non-empty URL strings",
      });
    }

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
      images: images?.map((img) => img.trim()),
      category,
      brand: brand?.trim(),
      stock: stock === undefined ? 0 : Number(stock),
      sku: sku.trim(),
    });

    return res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: product,
    });
  } catch (error) {
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
      const escapedSearch = search.trim().replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

      filter.name = {
        $regex: escapedSearch,$options: "i",
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
  try {
    const { id } = req.params;
    const {
      name,
      description,
      price,
      compareAtPrice,
      images,
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
      images,
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

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No fields provided for update",
      });
    }

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

    if (updates.brand !== undefined && typeof updates.brand === "string") {
      updates.brand = updates.brand.trim();
    }

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

    if (updates.price !== undefined) {
      if (!isValidNumber(updates.price) || Number(updates.price) < 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid price",
        });
      }
      updates.price = Number(updates.price);
    }

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

    if (
      updates.images !== undefined &&
      (!Array.isArray(updates.images) ||
        updates.images.some((img) => typeof img !== "string" || !img.trim()))
    ) {
      return res.status(400).json({
        success: false,
        message: "Images must be an array of non-empty URL strings",
      });
    }

    const product = await Product.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
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
      message: "Product updated successfully",
      data: product,
    });
  } catch (error) {
    return handleError(res, error, "Failed to update product");
  }
};

// DELETE PRODUCT (SOFT DELETE)
export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    const product = await Product.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    ).lean();

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Product deactivated successfully",
    });
  } catch (error) {
    return handleError(res, error, "Failed to delete product");
  }
};