import Product from "../models/product.model.js";
import Vendor from "../models/vendor.model.js";
import Category from "../models/category.model.js";
import isValidObjectId from "../utils/validateObjectId.js";
import handleError from "../utils/handleError.js";
import { isValidNumber } from "../utils/number.utils.js";

// GET ALL PRODUCTS
export const getProducts = async (req, res) => {
  try {
    const {
      search,
      category,
      brand,
      inStock,
      minPrice,
      maxPrice,
      minRating,
      page = 1,
      limit = 12,
      sort = "newest",
    } = req.query;

    for (const [name, value] of Object.entries({
      search,
      category,
      brand,
      inStock,
      minPrice,
      maxPrice,
      minRating,
      page: req.query.page,
      limit: req.query.limit,
      sort,
    })) {
      if (value !== undefined && typeof value !== "string") {
        return res.status(400).json({
          success: false,
          message: `Invalid ${name} query parameter`,
        });
      }
    }

    const pageNumber = Number(page);
    const limitNumber = Number(limit);

    if (
      !isValidNumber(page) ||
      !isValidNumber(limit) ||
      !Number.isSafeInteger(pageNumber) ||
      !Number.isSafeInteger(limitNumber) ||
      pageNumber < 1 ||
      limitNumber < 1 ||
      limitNumber > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid page or limit",
      });
    }

    const activeCategoryIds = await Category.distinct("_id", { isActive: true });
    const approvedVendorIds = await Vendor.distinct("_id", { status: "approved" });
    const filter = {
      isActive: true,
      isDeleted: false,
      category: { $in: activeCategoryIds },
      vendor: { $in: approvedVendorIds },
    };

    if (search?.trim()) {
      const escapedSearch = search
        .trim()
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      filter.name = { $regex: escapedSearch, $options: "i" };
    }

    if (brand?.trim()) {
      const escapedBrand = brand
        .trim()
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.brand = { $regex: escapedBrand, $options: "i" };
    }

    if (inStock !== undefined && inStock !== "true" && inStock !== "false") {
      return res.status(400).json({
        success: false,
        message: "Invalid inStock query parameter",
      });
    }
    if (inStock === "true") filter.stock = { $gt: 0 };
    if (inStock === "false") filter.stock = { $lte: 0 };

    if (category && category.trim() !== "") {
      if (!isValidObjectId(category)) {
        return res.status(400).json({
          success: false,
          message: "Invalid category ID",
        });
      }

      if (!(await Category.exists({ _id: category, isActive: true }))) {
        return res.status(404).json({
          success: false,
          message: "Category not found",
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

    if (minRating !== undefined && minRating.trim() !== "") {
      const rating = Number(minRating);
      if (!isValidNumber(minRating) || rating < 1 || rating > 5) {
        return res.status(400).json({
          success: false,
          message: "Minimum rating must be between 1 and 5",
        });
      }
      filter.ratingsAverage = { $gte: rating };
    }

    const sortOptions = {
      newest: { createdAt: -1 },
      price_asc: { price: 1 },
      price_desc: { price: -1 },
      name_asc: { name: 1 },
    };

    if (!Object.prototype.hasOwnProperty.call(sortOptions, sort)) {
      return res.status(400).json({
        success: false,
        message: "Invalid sort option",
      });
    }

    const skip = (pageNumber - 1) * limitNumber;
    if (!Number.isSafeInteger(skip)) {
      return res.status(400).json({
        success: false,
        message: "Invalid page or limit",
      });
    }

    const [products, total] = await Promise.all([
      Product.find(filter)
        .populate("category", "name slug")
        .populate("vendor", "storeName slug")
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
      isDeleted: false,
      vendor: { $in: await Vendor.distinct("_id", { status: "approved" }) },
    })
      .populate({
        path: "category",
        match: { isActive: true },
        select: "name slug",
      })
      .populate("vendor", "storeName slug")
      .lean();

    if (!product || !product.category) {
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
