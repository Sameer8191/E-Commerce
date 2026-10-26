import mongoose from "mongoose";
import User from "../models/user.model.js";
import Product from "../models/product.model.js";
import Category from "../models/category.model.js";
import Order from "../models/order.model.js";
import Review from "../models/review.model.js";
import Visitor from "../models/visitor.model.js";
import AdminSetting from "../models/admin-setting.model.js";
import AdminActivity from "../models/admin-activity.model.js";
import AdminNotification from "../models/admin-notification.model.js";
import Vendor from "../models/vendor.model.js";
import { attemptRefund } from "../services/paymentService.js";
import { notifyCustomerOrder } from "../services/customerNotificationService.js";
import isValidObjectId from "../utils/validateObjectId.js";
import { isValidNumber } from "../utils/number.utils.js";
import { uploadImage, deleteCloudinaryImages } from "../utils/cloudinary.upload.js";
import { readProductImageArchive } from "../utils/productImportArchive.js";
import { hasPermission, PERMISSIONS } from "../config/admin-permissions.js";
import { moneyToPaise } from "../utils/order.utils.js";
import { notifyStockRestock } from "./storefront.controller.js";

const logAdminActivity = async (req, action, entityType, entityId, summary, metadata = {}) => {
  try {
    await AdminActivity.create({ actor: req.user.userId, action, entityType, entityId: String(entityId || ""), summary, metadata });
  } catch (error) {
    console.error("Admin activity log failed:", error);
  }
};

export const getAdminSettings = async (_req, res) => {
  try {
    const settings = await AdminSetting.findOneAndUpdate(
      { key: "store" }, { $setOnInsert: { key: "store", monthlySalesTarget: 100000 } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean();
    return res.json({ success: true, data: settings });
  } catch (error) {
    console.error("Get admin settings error:", error);
    return res.status(500).json({ success: false, message: "Could not load store settings" });
  }
};

export const updateMonthlySalesTarget = async (req, res) => {
  const target = req.body?.monthlySalesTarget;
  if (!Number.isFinite(target) || target < 1 || target > 1_000_000_000) {
    return res.status(400).json({ success: false, message: "Monthly target must be between 1 and 1,000,000,000" });
  }
  try {
    const settings = await AdminSetting.findOneAndUpdate(
      { key: "store" }, { $set: { monthlySalesTarget: target } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    ).lean();
    await logAdminActivity(req, "sales_target_updated", "store_settings", settings._id, `Monthly sales target set to ₹${target.toLocaleString("en-IN")}`, { monthlySalesTarget: target });
    return res.json({ success: true, data: settings });
  } catch (error) {
    console.error("Update monthly target error:", error);
    return res.status(500).json({ success: false, message: "Could not update monthly sales target" });
  }
};

export const getAdminActivity = async (_req, res) => {
  try {
    const entries = await AdminActivity.find().sort({ createdAt: -1 }).limit(100).populate("actor", "name email").lean();
    return res.json({ success: true, data: entries });
  } catch (error) {
    console.error("Get admin activity error:", error);
    return res.status(500).json({ success: false, message: "Could not load admin activity" });
  }
};

// Admin catalog operations. Bulk requests are intentionally capped to keep one
// import bounded and return row-level errors so a bad row doesn't hide others.
export const createAdminCategory = async (req, res) => {
  const { name, slug, description = "", image = "" } = req.body ?? {};
  const normalizedName = typeof name === "string" ? name.trim() : "";
  const normalizedSlug =
    typeof slug === "string" ? slug.trim().toLowerCase() : "";
  if (!normalizedName || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalizedSlug)) {
    return res
      .status(400)
      .json({ success: false, message: "A name and valid slug are required" });
  }
  try {
    const category = await Category.create({
      name: normalizedName,
      slug: normalizedSlug,
      description,
      image,
    });
    return res.status(201).json({ success: true, data: category });
  } catch (error) {
    if (error.code === 11000)
      return res
        .status(409)
        .json({
          success: false,
          message: "A category with that name or slug already exists",
        });
    console.error("Create admin category error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to create category" });
  }
};

export const bulkCreateAdminProducts = async (req, res) => {
  let uploadedImages = [];
  let imagesPersisted = false;
  let rows = req.body?.products;
  if (typeof rows === "string") {
    try { rows = JSON.parse(rows); } catch { rows = null; }
  }
  if (!Array.isArray(rows) || rows.length === 0 || rows.length > 500) {
    return res
      .status(400)
      .json({ success: false, message: "Provide between 1 and 500 products" });
  }
  try {
    const imageZip = req.files?.imagesZip?.[0];
    const archiveImages = imageZip
      ? await readProductImageArchive(imageZip.buffer)
      : new Map();
    const platformVendor = await Vendor.findOne({ isPlatform: true, status: "approved" }).select("_id").lean();
    if (!platformVendor) {
      return res.status(409).json({
        success: false,
        message: "Set up the platform store before importing products.",
      });
    }
    const categories = await Category.find({ isActive: true })
      .select("_id name slug")
      .lean();
    const categoryByName = new Map(
      categories.flatMap((item) => [
        [item.name.toLowerCase(), item._id],
        [item.slug.toLowerCase(), item._id],
        [String(item._id), item._id],
      ]),
    );
    let valid = [];
    const errors = [];
    const seenSkus = new Set();
    rows.forEach((row, index) => {
      const line = index + 2;
      const name = typeof row?.name === "string" ? row.name.trim() : "";
      const description =
        typeof row?.description === "string" ? row.description.trim() : "";
      const sku =
        typeof row?.sku === "string" ? row.sku.trim().toUpperCase() : "";
      const category = categoryByName.get(
        String(row?.category ?? "")
          .trim()
          .toLowerCase(),
      );
      const issues = [];
      let imageNames = [];
      if (row?.images !== undefined && row.images !== null && row.images !== "") {
        if (typeof row.images !== "string") {
          issues.push("images must be ZIP file names separated by |");
        } else {
          imageNames = row.images.split("|").map((filename) => filename.trim());
          if (
            imageNames.some((filename) => !filename) ||
            imageNames.length > 5 ||
            new Set(imageNames).size !== imageNames.length
          ) {
            issues.push("images must contain 1–5 unique ZIP file names");
          } else if (!imageZip) {
            issues.push("images require an uploaded ZIP archive");
          } else if (imageNames.some((filename) => !archiveImages.has(filename))) {
            issues.push("an image file listed for this product was not found in the ZIP");
          }
        }
      }
      if (!name) issues.push("name is required");
      if (!description) issues.push("description is required");
      if (!sku) issues.push("sku is required");
      if (sku && seenSkus.has(sku)) issues.push("duplicate SKU in file");
      if (sku) seenSkus.add(sku);
      if (!category)
        issues.push("category must match an active category name, slug, or ID");
      if (
        !isValidNumber(row?.price) ||
        Number(row.price) < 0 ||
        Math.round(Number(row.price) * 100) !== Number(row.price) * 100
      )
        issues.push(
          "price must be a non-negative amount with up to 2 decimals",
        );
      const stock =
        row?.stock === "" || row?.stock === undefined ? 0 : Number(row.stock);
      if (!Number.isSafeInteger(stock) || stock < 0)
        issues.push("stock must be a non-negative integer");
      const compareAtPrice =
        row?.compareAtPrice === "" || row?.compareAtPrice == null
          ? null
          : Number(row.compareAtPrice);
      if (
        compareAtPrice !== null &&
        (!isValidNumber(compareAtPrice) ||
          compareAtPrice < Number(row.price) ||
          Math.round(compareAtPrice * 100) !== compareAtPrice * 100)
      )
        issues.push(
          "compareAtPrice must be blank or at least price (up to 2 decimals)",
        );
      if (issues.length)
        errors.push({ row: line, sku, message: issues.join("; ") });
      else {
        valid.push({
          vendor: platformVendor._id,
          sourceLine: line,
          name,
          description,
          sku,
          category,
          price: Number(row.price),
          stock,
          compareAtPrice,
          brand: typeof row.brand === "string" ? row.brand.trim() : "",
          imageNames,
        });
      }
    });
    if (valid.length) {
      const imageTasks = [];
      for (const product of valid) {
        product.images = [];
        product.imageUploadFailed = false;
        product.imageNames.forEach((filename, imageIndex) => {
          imageTasks.push({
            product,
            imageIndex,
            file: archiveImages.get(filename),
          });
        });
      }
      let nextImageTask = 0;
      const workers = Array.from(
        { length: Math.min(5, imageTasks.length) },
        async () => {
          while (nextImageTask < imageTasks.length) {
            const task = imageTasks[nextImageTask];
            nextImageTask += 1;
            try {
              const image = await uploadImage(task.file);
              task.product.images[task.imageIndex] = image;
              uploadedImages.push(image);
            } catch {
              task.product.imageUploadFailed = true;
            }
          }
        },
      );
      await Promise.all(workers);

      const productsWithUploadedImages = [];
      for (const product of valid) {
        if (product.imageUploadFailed) {
          const imagesToDelete = product.images.filter(Boolean);
          await deleteCloudinaryImages(imagesToDelete);
          uploadedImages = uploadedImages.filter(
            (image) => !imagesToDelete.includes(image),
          );
          errors.push({
            row: product.sourceLine,
            sku: product.sku,
            message: "Product images could not be uploaded.",
          });
        } else {
          delete product.imageUploadFailed;
          productsWithUploadedImages.push(product);
        }
      }
      valid = productsWithUploadedImages;

      if (!valid.length) {
        return res.status(400).json({
          success: false,
          message: "No products were imported",
          data: { imported: 0, errors },
        });
      }
      const productsToInsert = valid.map(
        ({ sourceLine, imageNames, ...product }) => ({
          ...product,
          images: product.images || [],
        }),
      );
      let result;
      try {
        result = await Product.insertMany(productsToInsert, { ordered: false });
      } catch (error) {
        if (!error.writeErrors) throw error;
        const failedIndexes = new Set(error.writeErrors.map((item) => item.index));
        const insertedCount = error.insertedDocs?.length ?? Math.max(0, productsToInsert.length - failedIndexes.size);
        const dbErrors = error.writeErrors.map(({ index, err }) => ({ row: valid[index]?.sourceLine, sku: valid[index]?.sku, message: err?.code === 11000 ? "SKU already exists" : err?.errmsg || "Product could not be saved" }));
        const allErrors = [...errors, ...dbErrors];
        const imagesToDelete = [...failedIndexes].flatMap(
          (index) => valid[index]?.images || [],
        );
        await deleteCloudinaryImages(imagesToDelete);
        uploadedImages = uploadedImages.filter(
          (image) => !imagesToDelete.includes(image),
        );
        imagesPersisted = true;
        return res.status(207).json({ success: false, message: `${insertedCount} products imported`, data: { imported: insertedCount, errors: allErrors } });
      }
      imagesPersisted = true;
      return res
        .status(errors.length ? 207 : 201)
        .json({
          success: errors.length === 0,
          message: `${result.length} products imported`,
          data: { imported: result.length, errors },
        });
    }
    return res
      .status(400)
      .json({
        success: false,
        message: "No products were imported",
        data: { imported: 0, errors },
      });
  } catch (error) {
    if (!imagesPersisted && uploadedImages.length) {
      await deleteCloudinaryImages(uploadedImages);
    }
    if (error.statusCode) {
      return res
        .status(error.statusCode)
        .json({ success: false, message: error.message });
    }
    if (error.writeErrors)
      return res
        .status(207)
        .json({
          success: false,
          message: "Some products could not be imported",
          data: {
            imported: error.insertedDocs?.length ?? 0,
            errors: [
              ...(req.body.products || []).map((row, i) => ({
                row: i + 2,
                sku: row?.sku,
                message: "See validation or SKU conflict",
              })),
            ],
          },
        });
    console.error("Bulk product import error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to import products" });
  }
};

export const getAdminCatalogInsights = async (_req, res) => {
  try {
    const [totals, byCategory, recentProducts] = await Promise.all([
      Product.aggregate([
        { $match: { isDeleted: { $ne: true } } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            active: { $sum: { $cond: ["$isActive", 1, 0] } },
            stockUnits: { $sum: "$stock" },
            inventoryValue: { $sum: { $multiply: ["$price", "$stock"] } },
            lowStock: { $sum: { $cond: [{ $and: [{ $gt: ["$stock", 0] }, { $lte: ["$stock", { $ifNull: ["$lowStockThreshold", 5] }] }] }, 1, 0] } },
            outOfStock: { $sum: { $cond: [{ $eq: ["$stock", 0] }, 1, 0] } },
          },
        },
      ]),
      Product.aggregate([
        { $match: { isDeleted: { $ne: true } } },
        {
          $group: {
            _id: "$category",
            products: { $sum: 1 },
            units: { $sum: "$stock" },
            value: { $sum: { $multiply: ["$price", "$stock"] } },
          },
        },
        { $sort: { products: -1 } },
        { $limit: 12 },
        {
          $lookup: {
            from: "categories",
            localField: "_id",
            foreignField: "_id",
            as: "category",
          },
        },
        { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 1,
            name: "$category.name",
            products: 1,
            units: 1,
            value: 1,
          },
        },
      ]),
      Product.find({ isDeleted: { $ne: true } })
        .select("name description sku price compareAtPrice category brand stock isActive")
        .sort({ createdAt: -1 })
        .limit(6)
        .lean(),
    ]);
    return res.json({
      success: true,
      data: {
        ...(totals[0] ?? {
          total: 0,
          active: 0,
          stockUnits: 0,
          inventoryValue: 0,
          lowStock: 0,
          outOfStock: 0,
        }),
        byCategory,
        recentProducts,
      },
    });
  } catch (error) {
    console.error("Get admin catalog insights error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch catalog insights" });
  }
};

export const getAdminInventory = async (req, res) => {
  try {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);
    const { status = "all", search = "" } = req.query;
    if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
      return res.status(400).json({ success: false, message: "Invalid pagination parameters" });
    }
    if (!['all', 'in_stock', 'low_stock', 'out_of_stock'].includes(status) || typeof search !== "string" || search.length > 100) {
      return res.status(400).json({ success: false, message: "Invalid inventory filter" });
    }
    const filter = { isDeleted: { $ne: true } };
    if (search.trim()) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [{ name: { $regex: escaped, $options: "i" } }, { sku: { $regex: escaped, $options: "i" } }];
    }
    if (status === "out_of_stock") filter.stock = 0;
    if (status === "in_stock") filter.$expr = { $gt: ["$stock", { $ifNull: ["$lowStockThreshold", 5] }] };
    if (status === "low_stock") filter.$expr = { $and: [{ $gt: ["$stock", 0] }, { $lte: ["$stock", { $ifNull: ["$lowStockThreshold", 5] }] }] };
    const [products, total] = await Promise.all([
      Product.find(filter).populate("category", "name").select("name sku category price stock lowStockThreshold isActive").sort({ stock: 1, name: 1 }).skip((page - 1) * limit).limit(limit).lean(),
      Product.countDocuments(filter),
    ]);
    return res.json({ success: true, data: products, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    console.error("Get admin inventory error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch inventory" });
  }
};

export const adjustAdminInventory = async (req, res) => {
  const { productId } = req.params;
  const { adjustment, lowStockThreshold } = req.body ?? {};
  if (!isValidObjectId(productId)) return res.status(400).json({ success: false, message: "Invalid product ID" });
  if (!Number.isSafeInteger(adjustment) || Math.abs(adjustment) > 1000000 || (adjustment === 0 && lowStockThreshold === undefined)) return res.status(400).json({ success: false, message: "Provide a stock adjustment of at most 1,000,000 units or a low stock threshold" });
  if (lowStockThreshold !== undefined && (!Number.isSafeInteger(lowStockThreshold) || lowStockThreshold < 0)) {
    return res.status(400).json({ success: false, message: "Low stock threshold must be a non-negative whole number" });
  }
  try {
    const filter = { _id: productId, isDeleted: { $ne: true } };
    if (adjustment < 0) filter.stock = { $gte: Math.abs(adjustment) };
    const before = await Product.findById(productId).select("stock").lean();
    const product = await Product.findOneAndUpdate(filter, {
      $inc: { stock: adjustment },
      ...(lowStockThreshold !== undefined && { $set: { lowStockThreshold } }),
    }, { new: true, runValidators: true }).select("name sku stock lowStockThreshold");
    if (!product) {
      const exists = await Product.exists({ _id: productId, isDeleted: { $ne: true } });
      return res.status(exists ? 409 : 404).json({ success: false, message: exists ? "Adjustment would make stock negative" : "Product not found" });
    }
    await logAdminActivity(req, "inventory_adjusted", "product", productId, `Inventory updated for ${product.name}`, { adjustment, stock: product.stock, lowStockThreshold: product.lowStockThreshold });
    if (Number(before?.stock) <= 0 && product.stock > 0) void notifyStockRestock(product).catch((error) => console.error("Stock alert delivery failed:", error));
    return res.json({ success: true, message: "Inventory updated", data: product });
  } catch (error) {
    console.error("Adjust admin inventory error:", error);
    return res.status(500).json({ success: false, message: "Failed to update inventory" });
  }
};

// GET ADMIN DASHBOARD
export const getAdminDashboard = async (req, res) => {
  try {
    const requestedDays = Number(req.query.days ?? 30);
    const days = [7, 30, 90].includes(requestedDays) ? requestedDays : 30;
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - days + 1);
    start.setHours(0, 0, 0, 0);
    const previousStart = new Date(start);
    previousStart.setDate(previousStart.getDate() - days);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const delayedFulfillmentBefore = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      totalCustomers,
      totalProducts,
      totalCategories,
      totalOrders,
      activeProducts,
      inactiveProducts,
      lowStockProductCount,
      lowStockProducts,
      recentOrders,
      salesByDay,
      orderStatusBreakdown,
      topProducts,
      currentPeriod,
      previousPeriod,
      newCustomers,
      monthlyRevenue,
      categoryRevenue,
      mostReviewedProducts,
      visitors,
      pendingPaymentOrders,
      failedPayments,
      pendingFulfillment,
      delayedFulfillment,
      expiringReservations,
      storeSettings,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: "customer" }),
      Product.countDocuments(),
      Category.countDocuments(),
      Order.countDocuments(),
      Product.countDocuments({ isActive: true }),
      Product.countDocuments({ isActive: false }),
      Product.countDocuments({ isActive: true, isDeleted: { $ne: true }, $expr: { $lte: ["$stock", { $ifNull: ["$lowStockThreshold", 5] }] } }),
      Product.find({
        isActive: true,
        isDeleted: { $ne: true },
        $expr: { $lte: ["$stock", { $ifNull: ["$lowStockThreshold", 5] }] },
      })
        .select("name sku stock price images")
        .sort({ stock: 1, name: 1 })
        .limit(8)
        .lean(),
      Order.find().sort({ placedAt: -1, _id: -1 }).limit(8).lean(),
      Order.aggregate([
        {
          $match: {
            placedAt: { $gte: start, $lte: now },
            paymentStatus: { $in: ["paid", "partially_refunded"] },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$placedAt" } },
            revenue: { $sum: { $subtract: ["$totalAmount", { $ifNull: ["$returnRequest.refundAmount", 0] }] } },
            orders: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Order.aggregate([
        { $match: { placedAt: { $gte: start, $lte: now } } },
        { $group: { _id: "$orderStatus", count: { $sum: 1 } } },
      ]),
      Order.aggregate([
        {
          $match: {
            placedAt: { $gte: start, $lte: now },
            paymentStatus: { $in: ["paid", "partially_refunded"] },
          },
        },
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.product",
            name: { $first: "$items.name" },
            units: { $sum: "$items.quantity" },
            revenue: {
              $sum: { $multiply: ["$items.price", "$items.quantity"] },
            },
          },
        },
        { $sort: { revenue: -1 } },
        { $limit: 5 },
      ]),
      Order.aggregate([
        { $match: { placedAt: { $gte: start, $lte: now } } },
        {
          $group: {
            _id: null,
            orders: { $sum: 1 },
            revenue: {
              $sum: {
                $cond: [
                  { $in: ["$paymentStatus", ["paid", "partially_refunded"]] },
                  { $subtract: ["$totalAmount", { $ifNull: ["$returnRequest.refundAmount", 0] }] },
                  0,
                ],
              },
            },
            paidOrders: {
              $sum: {
                $cond: [{ $in: ["$paymentStatus", ["paid", "partially_refunded"]] }, 1, 0],
              },
            },
            averageOrderValue: {
              $avg: {
                $cond: [
                  { $in: ["$paymentStatus", ["paid", "partially_refunded"]] },
                  { $subtract: ["$totalAmount", { $ifNull: ["$returnRequest.refundAmount", 0] }] },
                  null,
                ],
              },
            },
          },
        },
      ]),
      Order.aggregate([
        { $match: { placedAt: { $gte: previousStart, $lt: start } } },
        {
          $group: {
            _id: null,
            orders: { $sum: 1 },
            revenue: {
              $sum: {
                $cond: [
                  { $in: ["$paymentStatus", ["paid", "partially_refunded"]] },
                  { $subtract: ["$totalAmount", { $ifNull: ["$returnRequest.refundAmount", 0] }] },
                  0,
                ],
              },
            },
          },
        },
      ]),
      User.countDocuments({
        role: "customer",
        createdAt: { $gte: start, $lte: now },
      }),
      Order.aggregate([
        { $match: { placedAt: { $gte: monthStart, $lte: now }, paymentStatus: { $in: ["paid", "partially_refunded"] } } },
        { $group: { _id: null, revenue: { $sum: { $subtract: ["$totalAmount", { $ifNull: ["$returnRequest.refundAmount", 0] }] } }, orders: { $sum: 1 } } },
      ]),
      Order.aggregate([
        { $match: { placedAt: { $gte: monthStart, $lte: now }, paymentStatus: { $in: ["paid", "partially_refunded"] } } },
        { $unwind: "$items" },
        { $lookup: { from: "products", localField: "items.product", foreignField: "_id", as: "product" } },
        { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
        { $lookup: { from: "categories", localField: "product.category", foreignField: "_id", as: "category" } },
        { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
        { $group: { _id: { $ifNull: ["$category.name", "Uncategorized"] }, revenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } }, units: { $sum: "$items.quantity" } } },
        { $sort: { revenue: -1 } }, { $limit: 5 },
      ]),
      Review.aggregate([
        { $group: { _id: "$product", reviewCount: { $sum: 1 }, averageRating: { $avg: "$rating" } } },
        { $sort: { reviewCount: -1, averageRating: -1, _id: 1 } },
        { $lookup: { from: "products", localField: "_id", foreignField: "_id", as: "product" } },
        { $unwind: "$product" },
        { $match: { "product.isDeleted": { $ne: true } } },
        { $limit: 5 },
        { $project: { _id: 1, name: "$product.name", reviewCount: 1, averageRating: { $round: ["$averageRating", 1] } } },
      ]),
      Visitor.countDocuments({ visitedAt: { $gte: start, $lte: now } }),
      Order.countDocuments({ paymentMethod: "razorpay", paymentStatus: "pending" }),
      Order.countDocuments({ paymentStatus: "failed" }),
      Order.countDocuments({ orderStatus: { $in: ["confirmed", "processing", "shipped"] } }),
      Order.countDocuments({
        orderStatus: { $in: ["confirmed", "processing", "shipped"] },
        updatedAt: { $lte: delayedFulfillmentBefore },
      }),
      Order.countDocuments({ paymentMethod: "razorpay", paymentStatus: "pending", inventoryReleasedAt: null, inventoryExpiresAt: { $gt: now, $lte: new Date(now.getTime() + 15 * 60_000) } }),
      AdminSetting.findOne({ key: "store" }).select("monthlySalesTarget").lean(),
    ]);

    const monthToDate = { revenue: monthlyRevenue[0]?.revenue ?? 0, orders: monthlyRevenue[0]?.orders ?? 0 };
    const canReadInventory = hasPermission(req.user.role, PERMISSIONS.INVENTORY_READ);
    const canReadOrders = hasPermission(req.user.role, PERMISSIONS.ORDERS_READ);
    if (hasPermission(req.user.role, PERMISSIONS.SALES_TARGET_READ)) {
      monthToDate.target = storeSettings?.monthlySalesTarget ?? 100000;
    }
    return res.status(200).json({
      success: true,
      data: {
        totalUsers,
        totalCustomers,
        totalProducts,
        totalCategories,
        totalOrders,
        activeProducts,
        inactiveProducts,
        period: {
          days,
          revenue: currentPeriod[0]?.revenue ?? 0,
          orders: currentPeriod[0]?.orders ?? 0,
          paidOrders: currentPeriod[0]?.paidOrders ?? 0,
          averageOrderValue: currentPeriod[0]?.averageOrderValue ?? 0,
          newCustomers,
          previousRevenue: previousPeriod[0]?.revenue ?? 0,
          previousOrders: previousPeriod[0]?.orders ?? 0,
        },
        monthToDate,
        visitors,
        operationalAlerts: {
          ...(canReadInventory && { lowStockProducts: lowStockProductCount }),
          ...(canReadOrders && { pendingPaymentOrders, failedPayments, pendingFulfillment, delayedFulfillment, expiringReservations }),
        },
        categoryRevenue,
        mostReviewedProducts,
        salesByDay,
        orderStatusBreakdown: Object.fromEntries(
          orderStatusBreakdown.map(({ _id, count }) => [_id, count]),
        ),
        topProducts,
        lowStockProducts: canReadInventory ? lowStockProducts : [],
        recentOrders: canReadOrders ? recentOrders : [],
      },
    });
  } catch (error) {
    console.error("Get admin dashboard error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard statistics",
    });
  }
};

// ACTIVATE / DEACTIVATE USER
export const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    if (typeof isActive !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "isActive must be a boolean",
      });
    }

    // Prevent an admin from deactivating their own account
    if (id === req.user.userId && !isActive) {
      return res.status(400).json({
        success: false,
        message: "You cannot deactivate your own account",
      });
    }

    const user = await User.findOneAndUpdate(
      { _id: id, role: "customer" },
      {
        $set: { isActive },
        // Revoked tokens must stay revoked if the account is later reactivated.
        ...(!isActive && { $inc: { authTokenVersion: 1 } }),
      },
      {
        new: true,
        runValidators: true,
      },
    ).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    await logAdminActivity(req, isActive ? "customer_activated" : "customer_deactivated", "customer", id, `${user.name} ${isActive ? "activated" : "deactivated"}`);

    return res.status(200).json({
      success: true,
      message: `User ${isActive ? "activated" : "deactivated"} successfully`,
      data: user,
    });
  } catch (error) {
    console.error("Update user status error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update user status",
    });
  }
};

const ADMIN_ORDER_STATUSES = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
];

export const getAdminOrders = async (req, res) => {
  try {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);
    const { status, search = "" } = req.query;

    if (
      !Number.isSafeInteger(page) ||
      page < 1 ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 100 ||
      !Number.isSafeInteger((page - 1) * limit)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid pagination parameters",
      });
    }

    if (status !== undefined && !ADMIN_ORDER_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order status",
      });
    }

    if (typeof search !== "string" || search.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Search must be a string of at most 100 characters",
      });
    }

    const filter = status ? { orderStatus: status } : {};
    if (search.trim()) {
      const escapedSearch = search
        .trim()
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const searchFilter = [
        { orderNumber: { $regex: escapedSearch, $options: "i" } },
        {
          "shippingAddress.fullName": { $regex: escapedSearch, $options: "i" },
        },
        { "items.name": { $regex: escapedSearch, $options: "i" } },
      ];
      filter.$or = searchFilter;
      if (isValidObjectId(search.trim()))
        filter.$or.push({ _id: search.trim() });
    }
    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate("user", "name email")
        .sort({ placedAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Order.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: orders,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get admin orders failed:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch orders",
    });
  }
};

export const getAdminReturns = async (req, res) => {
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 20);
  const status = req.query.status ?? "all";
  const allowedStatuses = ["all", "requested", "approved", "rejected", "refunded"];
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    return res.status(400).json({ success: false, message: "Invalid pagination parameters" });
  }
  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: "Invalid return request status" });
  }

  const filter = status === "all"
    ? {
        $or: [
          { "returnRequest.status": { $in: ["requested", "approved", "rejected", "refunded"] } },
          { orderStatus: "cancelled", refundStatus: { $in: ["pending", "processing", "processed", "failed"] } },
        ],
      }
    : { "returnRequest.status": status };
  try {
    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate("user", "name email")
        .sort({ "returnRequest.requestedAt": -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Order.countDocuments(filter),
    ]);
    return res.json({
      success: true,
      data: orders,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Get admin returns error:", error);
    return res.status(500).json({ success: false, message: "Could not load return requests" });
  }
};

export const reviewAdminReturn = async (req, res) => {
  const { orderId } = req.params;
  const { action, note = "", refundReference = "" } = req.body ?? {};
  if (!isValidObjectId(orderId)) return res.status(400).json({ success: false, message: "Invalid order ID" });
  if (!["approve", "reject", "retry_refund", "mark_refunded"].includes(action)) {
    return res.status(400).json({ success: false, message: "Invalid return action" });
  }
  if (typeof note !== "string" || note.trim().length > 500) {
    return res.status(400).json({ success: false, message: "Review note must be 500 characters or fewer" });
  }
  if (action === "mark_refunded" && (typeof refundReference !== "string" || !refundReference.trim() || refundReference.trim().length > 200)) {
    return res.status(400).json({ success: false, message: "Provide the manual refund reference (200 characters or fewer)" });
  }

  try {
    const now = new Date();
    let order;
    if (action === "approve") {
      const approvalFilter = {
        _id: orderId,
        "returnRequest.status": "requested",
        orderStatus: "delivered",
        paymentStatus: "paid",
        refundStatus: "not_required",
      };
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          order = await Order.findOne(approvalFilter).session(session);
          if (!order) return;
          if (
            order.paymentMethod !== "cod"
            && (order.paymentMethod !== "razorpay" || !order.razorpayPaymentId)
          ) {
            order = null;
            return;
          }
          if (order.vendorOrders.some((vendorOrder) => vendorOrder.settlementStatus === "paid")) {
            const error = new Error("A seller settlement has already completed; this return cannot be approved automatically.");
            error.status = 409;
            throw error;
          }

          const returnItems = order.returnRequest.items?.length
            ? order.returnRequest.items
            : order.items;
          if (!order.returnRequest.items?.length) {
            order.returnRequest.items = returnItems.map((item) => ({
              product: item.product,
              name: item.name,
              price: item.price,
              quantity: item.quantity,
              image: item.image,
            }));
            order.returnRequest.refundAmount = order.totalAmount;
          }
          const returnedQuantities = new Map(
            returnItems.map((item) => [String(item.product), item.quantity]),
          );
          for (const vendorOrder of order.vendorOrders) {
            for (const item of vendorOrder.items) {
              const returnedQuantity = returnedQuantities.get(String(item.product)) || 0;
              if (!returnedQuantity) continue;
              const unitPricePaise = moneyToPaise(item.price);
              const returnedValuePaise = unitPricePaise * returnedQuantity;
              if (!Number.isSafeInteger(returnedValuePaise) || returnedQuantity > item.quantity) {
                const error = new Error("Returned quantities do not match the seller order items.");
                error.status = 409;
                throw error;
              }
              const returnedCommissionPaise = Math.round(returnedValuePaise * vendorOrder.commissionRate / 100);
              const returnedPayablePaise = returnedValuePaise - returnedCommissionPaise;
              vendorOrder.returnedItems.push({
                product: item.product,
                name: item.name,
                price: unitPricePaise / 100,
                quantity: returnedQuantity,
                image: item.image,
              });
              vendorOrder.returnedSubtotal = Math.round((vendorOrder.returnedSubtotal + returnedValuePaise / 100) * 100) / 100;
              vendorOrder.returnedCommissionAmount = Math.round((vendorOrder.returnedCommissionAmount + returnedCommissionPaise / 100) * 100) / 100;
              vendorOrder.returnedPayableAmount = Math.round((vendorOrder.returnedPayableAmount + returnedPayablePaise / 100) * 100) / 100;
              vendorOrder.subtotal = Math.round((vendorOrder.subtotal - returnedValuePaise / 100) * 100) / 100;
              vendorOrder.commissionAmount = Math.round((vendorOrder.commissionAmount - returnedCommissionPaise / 100) * 100) / 100;
              vendorOrder.payableAmount = Math.round((vendorOrder.payableAmount - returnedPayablePaise / 100) * 100) / 100;
              returnedQuantities.delete(String(item.product));
            }
          }
          if (returnedQuantities.size) {
            const error = new Error("A returned item is not assigned to an active seller order.");
            error.status = 409;
            throw error;
          }

          order.returnRequest.status = "approved";
          order.returnRequest.reviewedAt = now;
          order.returnRequest.reviewedBy = req.user.userId;
          order.returnRequest.reviewNote = note.trim();
          order.refundStatus = "pending";
          order.refundPaymentId = order.paymentMethod === "razorpay" ? order.razorpayPaymentId : null;
          order.refundNextAttemptAt = order.paymentMethod === "razorpay" ? now : null;
          order.refundError = null;
          await order.save({ session });
        });
      } finally {
        await session.endSession();
      }
    } else if (action === "reject") {
      order = await Order.findOneAndUpdate(
        { _id: orderId, "returnRequest.status": "requested" },
        {
          $set: {
            "returnRequest.status": "rejected",
            "returnRequest.reviewedAt": now,
            "returnRequest.reviewedBy": req.user.userId,
            "returnRequest.reviewNote": note.trim(),
          },
        },
        { new: true, runValidators: true },
      );
    } else if (action === "retry_refund") {
      order = await Order.findOneAndUpdate(
        {
          _id: orderId,
          "returnRequest.status": "approved",
          paymentMethod: "razorpay",
          refundPaymentId: { $type: "string" },
          refundStatus: { $in: ["pending", "failed"] },
        },
        { $set: { refundStatus: "pending", refundNextAttemptAt: now, refundError: null } },
        { new: true },
      );
    } else {
      const manualRefundFilter = {
          _id: orderId,
          "returnRequest.status": "approved",
          paymentMethod: "cod",
          paymentStatus: "paid",
          refundStatus: { $in: ["pending", "failed"] },
        };
      const approvedReturn = await Order.findOne(manualRefundFilter)
        .select("totalAmount returnRequest.refundAmount")
        .lean();
      if (approvedReturn) {
        const paymentStatus = approvedReturn.returnRequest.refundAmount >= approvedReturn.totalAmount
          ? "refunded"
          : "partially_refunded";
        order = await Order.findOneAndUpdate(
          manualRefundFilter,
          { $set: {
            "returnRequest.status": "refunded",
            "returnRequest.reviewedAt": now,
            "returnRequest.reviewedBy": req.user.userId,
            "returnRequest.reviewNote": note.trim(),
            refundStatus: "processed",
            refundNextAttemptAt: null,
            refundError: null,
            manualRefundReference: refundReference.trim(),
            paymentStatus,
          } },
          { new: true, runValidators: true },
        );
      }
    }

    if (!order) {
      const exists = await Order.exists({ _id: orderId });
      return res.status(exists ? 409 : 404).json({
        success: false,
        message: exists ? "The return request cannot be updated in its current state" : "Order not found",
      });
    }

    await AdminNotification.updateOne(
      { key: `return:${order._id}` },
      { $set: { active: false } },
    );
    await logAdminActivity(
      req,
      `return_${action}`,
      "order",
      orderId,
      `Return request for ${order.orderNumber}: ${action.replaceAll("_", " ")}`,
      { status: order.returnRequest.status, refundStatus: order.refundStatus, refundReference: action === "mark_refunded" ? refundReference.trim() : undefined },
    );

    if (action === "approve" && order.paymentMethod === "razorpay" && order.refundPaymentId) {
      await attemptRefund(order._id);
    } else if (action === "retry_refund") {
      await attemptRefund(order._id);
    }
    const currentOrder = await Order.findById(orderId).populate("user", "name email").lean();
    if (["approve", "reject", "mark_refunded"].includes(action)) {
      const statusMessage = action === "approve"
        ? `Your return request for order ${currentOrder.orderNumber} was approved.`
        : action === "reject"
          ? `Your return request for order ${currentOrder.orderNumber} was declined.`
          : `The manual refund for order ${currentOrder.orderNumber} has been recorded.`;
      void notifyCustomerOrder({
        order: currentOrder,
        eventKey: `order:${currentOrder._id}:return-${action}`,
        title: action === "approve" ? "Return request approved" : action === "reject" ? "Return request update" : "Refund recorded",
        message: statusMessage,
        subject: `Return update for order ${currentOrder.orderNumber}`,
      });
    }
    return res.json({ success: true, message: "Return request updated", data: currentOrder });
  } catch (error) {
    console.error("Review admin return error:", error);
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    return res.status(500).json({ success: false, message: "Could not update return request" });
  }
};

export const getAdminNotifications = async (req, res) => {
  try {
    const visibleTypes = [];
    if (hasPermission(req.user.role, PERMISSIONS.INVENTORY_READ)) visibleTypes.push("low_stock");
    if (hasPermission(req.user.role, PERMISSIONS.RETURNS_READ)) visibleTypes.push("return_request");
    if (!visibleTypes.length) {
      return res.status(403).json({ success: false, code: "INSUFFICIENT_PERMISSION", message: "Notifications are not available for this staff role." });
    }
    const lowStockProducts = await Product.find({
      isActive: true,
      isDeleted: { $ne: true },
      $expr: { $lte: ["$stock", { $ifNull: ["$lowStockThreshold", 5] }] },
    }).select("_id name stock lowStockThreshold").lean();
    const productIds = lowStockProducts.map((product) => String(product._id));
    const existing = visibleTypes.includes("low_stock")
      ? await AdminNotification.find({ type: "low_stock" }).lean()
      : [];
    const existingByProductId = new Map(existing.map((item) => [item.entityId, item]));
    const updates = visibleTypes.includes("low_stock") ? lowStockProducts.map((product) => {
      const entityId = String(product._id);
      const prior = existingByProductId.get(entityId);
      const isNewAlert = !prior || !prior.active;
      const set = {
        type: "low_stock",
        entityId,
        title: product.stock === 0 ? "Product out of stock" : "Low stock threshold crossed",
        message: `${product.name}: ${product.stock} in stock (alert at ${product.lowStockThreshold ?? 5})`,
        active: true,
        metadata: { productName: product.name, stock: product.stock, threshold: product.lowStockThreshold ?? 5 },
      };
      if (prior && isNewAlert) set.readBy = [];
      const update = { $set: set };
      if (!prior) update.$setOnInsert = { readBy: [] };
      return {
        updateOne: {
          filter: { key: `low-stock:${entityId}` },
          update,
          upsert: true,
        },
      };
    }) : [];
    if (updates.length) await AdminNotification.bulkWrite(updates);

    const activeProductIds = new Set(productIds);
    const resolvedIds = existing
      .filter((item) => item.active && !activeProductIds.has(item.entityId))
      .map((item) => item._id);
    if (resolvedIds.length) {
      await AdminNotification.updateMany({ _id: { $in: resolvedIds } }, { $set: { active: false } });
    }

    const [notifications, unreadCount] = await Promise.all([
      AdminNotification.find({ active: true, type: { $in: visibleTypes } }).sort({ updatedAt: -1 }).limit(50).lean(),
      AdminNotification.countDocuments({ active: true, type: { $in: visibleTypes }, readBy: { $ne: req.user._id } }),
    ]);
    const data = notifications
      .map((notification) => ({
        ...notification,
        isRead: notification.readBy?.some((adminId) => String(adminId) === String(req.user._id)) || false,
      }))
      .sort((left, right) => Number(left.isRead) - Number(right.isRead));
    return res.json({ success: true, data, unreadCount });
  } catch (error) {
    console.error("Get admin notifications error:", error);
    return res.status(500).json({ success: false, message: "Could not load admin notifications" });
  }
};

export const markAdminNotificationRead = async (req, res) => {
  const { notificationId } = req.params;
  if (!isValidObjectId(notificationId)) return res.status(400).json({ success: false, message: "Invalid notification ID" });
  try {
    const current = await AdminNotification.findOne(
      { _id: notificationId, active: true },
    ).select("type");
    if (!current) return res.status(404).json({ success: false, message: "Notification not found" });
    const allowed = current.type === "low_stock"
      ? hasPermission(req.user.role, PERMISSIONS.INVENTORY_READ)
      : current.type === "return_request" && hasPermission(req.user.role, PERMISSIONS.RETURNS_READ);
    if (!allowed) return res.status(403).json({ success: false, code: "INSUFFICIENT_PERMISSION", message: "This notification is not available for your staff role." });
    const notification = await AdminNotification.findOneAndUpdate(
      { _id: notificationId, active: true },
      { $addToSet: { readBy: req.user._id } },
      { new: true },
    );
    if (!notification) return res.status(404).json({ success: false, message: "Notification not found" });
    return res.json({ success: true, data: notification });
  } catch (error) {
    console.error("Mark admin notification read error:", error);
    return res.status(500).json({ success: false, message: "Could not update notification" });
  }
};

export const getAdminOrderById = async (req, res) => {
  const { orderId } = req.params;
  if (!isValidObjectId(orderId)) return res.status(400).json({ success: false, message: "Invalid order ID" });
  try {
    const [order, activity] = await Promise.all([
      Order.findById(orderId).populate("user", "name email").lean(),
      hasPermission(req.user.role, PERMISSIONS.ACTIVITY_READ)
        ? AdminActivity.find({ entityType: "order", entityId: orderId }).sort({ createdAt: -1 }).limit(20).populate("actor", "name").lean()
        : Promise.resolve([]),
    ]);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });
    return res.json({ success: true, data: { order, activity } });
  } catch (error) {
    console.error("Get admin order details error:", error);
    return res.status(500).json({ success: false, message: "Failed to load order details" });
  }
};

const ORDER_STATUS_TRANSITIONS = {
  processing: "confirmed",
  shipped: "processing",
  delivered: "shipped",
};

export const updateAdminOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body ?? {};

    if (!isValidObjectId(orderId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    if (!Object.hasOwn(ORDER_STATUS_TRANSITIONS, status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be processing, shipped, or delivered",
      });
    }

    const previousStatus = ORDER_STATUS_TRANSITIONS[status];
    const order = await Order.findOneAndUpdate(
      {
        _id: orderId,
        orderStatus: previousStatus,
        $or: [
          { paymentMethod: "cod", paymentStatus: "pending" },
          { paymentMethod: "razorpay", paymentStatus: "paid" },
        ],
      },
      {
        $set: {
          orderStatus: status,
          "vendorOrders.$[vendorOrder].fulfillmentStatus": status,
          ...(status === "delivered" && { paymentStatus: "paid" }),
          ...(status === "delivered" && { deliveredAt: new Date() }),
        },
      },
      {
        new: true,
        runValidators: true,
        arrayFilters: [{ "vendorOrder.fulfillmentStatus": previousStatus }],
      },
    );

    if (!order) {
      const exists = await Order.exists({ _id: orderId });
      return res.status(exists ? 409 : 404).json({
        success: false,
        message: exists
          ? "Order cannot transition to the requested status"
          : "Order not found",
      });
    }

    await logAdminActivity(req, "order_status_updated", "order", orderId, `Order ${order.orderNumber} marked ${status}`, { from: previousStatus, to: status });
    if (["shipped", "delivered"].includes(status)) {
      void notifyCustomerOrder({
        order,
        eventKey: `order:${order._id}:${status}`,
        title: status === "shipped" ? "Your order is on its way" : "Your order was delivered",
        message: status === "shipped"
          ? `Order ${order.orderNumber} has shipped. Track its progress from Your orders.`
          : `Order ${order.orderNumber} is marked delivered. You can request a return from Your orders within the eligible return window.`,
        subject: `Delivery update for order ${order.orderNumber}`,
      });
    }

    return res.status(200).json({
      success: true,
      message: `Order marked ${status}`,
      data: order,
    });
  } catch (error) {
    console.error("Update admin order status failed:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update order status",
    });
  }
};

export const cancelAdminOrder = async (req, res) => {
  const { orderId } = req.params;
  if (!isValidObjectId(orderId)) return res.status(400).json({ success: false, message: "Invalid order ID" });
  const session = await mongoose.startSession();
  let cancelledOrder = null;
  let failure = null;
  try {
    await session.withTransaction(async () => {
      cancelledOrder = null;
      failure = null;
      const order = await Order.findOne({
        _id: orderId,
        orderStatus: { $in: ["pending", "confirmed", "processing"] },
        inventoryReleasedAt: null,
        $or: [{ paymentOrderCreationExpiresAt: null }, { paymentOrderCreationExpiresAt: { $lte: new Date() } }],
      }).session(session);
      if (!order) {
        failure = await Order.exists({ _id: orderId }).session(session)
          ? "Order cannot be cancelled in its current state"
          : "Order not found";
        return;
      }
      if (order.paymentStatus === "paid" && (!order.razorpayPaymentId || order.paymentMethod !== "razorpay")) {
        failure = "A captured payment cannot be refunded automatically for this order";
        return;
      }
      const shouldRefund = order.paymentStatus === "paid";
      order.orderStatus = "cancelled";
      order.vendorOrders.forEach((vendorOrder) => {
        if (!["cancelled", "delivered"].includes(vendorOrder.fulfillmentStatus)) {
          vendorOrder.fulfillmentStatus = "cancelled";
        }
      });
      order.inventoryReleasedAt = new Date();
      order.inventoryExpiresAt = null;
      if (shouldRefund) {
        order.refundStatus = "pending";
        order.refundPaymentId = order.razorpayPaymentId;
        order.refundNextAttemptAt = new Date();
        order.refundError = null;
      }
      await order.save({ session });
      for (const item of order.items) {
        const result = await Product.updateOne({ _id: item.product }, { $inc: { stock: item.quantity } }, { session });
        if (result.matchedCount !== 1) throw new Error(`Unable to restore stock for ${item.name}`);
      }
      cancelledOrder = order;
    });
    if (failure) return res.status(failure === "Order not found" ? 404 : 409).json({ success: false, message: failure });
    await logAdminActivity(req, "order_cancelled", "order", orderId, `Order ${cancelledOrder.orderNumber} cancelled by admin`, { refundStatus: cancelledOrder.refundStatus });
    void notifyCustomerOrder({
      order: cancelledOrder,
      eventKey: `order:${cancelledOrder._id}:cancelled`,
      title: "Order cancelled",
      message: `Order ${cancelledOrder.orderNumber} was cancelled. Any eligible refund will be shown in Your orders.`,
      subject: `Order ${cancelledOrder.orderNumber} cancelled`,
    });
    if (cancelledOrder.refundStatus === "pending") await attemptRefund(cancelledOrder._id);
    const currentOrder = await Order.findById(orderId).lean();
    return res.json({ success: true, message: ["pending", "processing", "failed"].includes(currentOrder.refundStatus) ? "Order cancelled; refund is being processed" : "Order cancelled", data: currentOrder });
  } catch (error) {
    console.error("Admin cancel order error:", error);
    return res.status(500).json({ success: false, message: "Failed to cancel order" });
  } finally {
    await session.endSession();
  }
};
