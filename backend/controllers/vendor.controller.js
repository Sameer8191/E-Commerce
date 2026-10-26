import mongoose from "mongoose";
import AdminActivity from "../models/admin-activity.model.js";
import AdminSetting from "../models/admin-setting.model.js";
import Order from "../models/order.model.js";
import Product from "../models/product.model.js";
import User from "../models/user.model.js";
import Vendor from "../models/vendor.model.js";
import VendorSettlement from "../models/vendor-settlement.model.js";
import isValidObjectId from "../utils/validateObjectId.js";
import { notifyCustomerOrder } from "../services/customerNotificationService.js";

const eligibleSettlementReturn = {
  $or: [
    {
      "returnRequest.status": { $in: ["none", "rejected", null] },
      refundStatus: "not_required",
    },
    {
      "returnRequest.status": "refunded",
      refundStatus: "processed",
      $expr: { $lt: ["$returnRequest.refundAmount", "$totalAmount"] },
    },
  ],
};

const slugify = (value) =>
  value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const roundMoney = (value) => Math.round(value * 100) / 100;

const recordActivity = async (actor, action, entityId, summary, metadata = {}) => {
  try {
    await AdminActivity.create({
      actor,
      action,
      entityType: "vendor",
      entityId: String(entityId),
      summary,
      metadata,
    });
  } catch (error) {
    console.error("Vendor activity log failed:", error);
  }
};

export const getMyVendorApplication = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user.userId, isPlatform: false })
      .select("storeName slug description contactEmail phone status applicationNote createdAt reviewedAt")
      .lean();
    return res.json({ success: true, data: vendor });
  } catch (error) {
    console.error("Get vendor application error:", error);
    return res.status(500).json({ success: false, message: "Could not load your vendor application" });
  }
};

export const applyToBecomeVendor = async (req, res) => {
  const { storeName, description = "", contactEmail, phone = "", applicationNote = "" } = req.body ?? {};
  const normalizedStore = typeof storeName === "string" ? storeName.trim() : "";
  const normalizedEmail = typeof contactEmail === "string" ? contactEmail.trim().toLowerCase() : "";
  if (
    normalizedStore.length < 2 ||
    normalizedStore.length > 100 ||
    typeof description !== "string" ||
    description.length > 1000 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) ||
    typeof phone !== "string" ||
    phone.length > 30 ||
    typeof applicationNote !== "string" ||
    applicationNote.length > 1000
  ) {
    return res.status(400).json({ success: false, message: "Provide a valid store name, email, and application details." });
  }
  if (req.user.role !== "customer") {
    return res.status(409).json({ success: false, message: "This account cannot submit a vendor application." });
  }
  try {
    const existing = await Vendor.findOne({ owner: req.user.userId, isPlatform: false });
    if (existing && !["rejected"].includes(existing.status)) {
      return res.status(409).json({ success: false, message: "A vendor application already exists for this account." });
    }
    const baseSlug = slugify(normalizedStore);
    if (!baseSlug) {
      return res.status(400).json({ success: false, message: "Store name must include letters or numbers." });
    }
    const slug = existing?.slug || `${baseSlug}-${req.user.userId.slice(-6)}`;
    const vendor = existing
      ? await Vendor.findByIdAndUpdate(existing._id, {
          $set: {
            storeName: normalizedStore,
            description: description.trim(),
            contactEmail: normalizedEmail,
            phone: phone.trim(),
            applicationNote: applicationNote.trim(),
            status: "pending",
            reviewedAt: null,
            reviewedBy: null,
          },
        }, { new: true, runValidators: true })
      : await Vendor.create({
          owner: req.user.userId,
          storeName: normalizedStore,
          slug,
          description: description.trim(),
          contactEmail: normalizedEmail,
          phone: phone.trim(),
          applicationNote: applicationNote.trim(),
        });
    return res.status(201).json({ success: true, message: "Vendor application submitted for review.", data: vendor });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "That store URL is already in use." });
    }
    console.error("Submit vendor application error:", error);
    return res.status(500).json({ success: false, message: "Could not submit your vendor application." });
  }
};

export const getVendorProducts = async (req, res) => {
  try {
    const products = await Product.find({ vendor: req.vendor._id, isDeleted: false })
      .populate("category", "name slug")
      .sort({ updatedAt: -1 })
      .limit(100)
      .lean();
    return res.json({ success: true, data: products });
  } catch (error) {
    console.error("Get vendor products error:", error);
    return res.status(500).json({ success: false, message: "Could not load your products." });
  }
};

export const getPublicVendorStorefront = async (req, res) => {
  const slug = typeof req.params.slug === "string" ? req.params.slug.trim().toLowerCase() : "";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return res.status(400).json({ success: false, message: "Invalid store URL." });
  }
  try {
    const vendor = await Vendor.findOne({ slug, status: "approved", isPlatform: false })
      .select("storeName slug description")
      .lean();
    if (!vendor) {
      return res.status(404).json({ success: false, message: "Store not found." });
    }
    const activeCategoryIds = await Category.distinct("_id", { isActive: true });
    const filter = {
      vendor: vendor._id,
      isActive: true,
      isDeleted: false,
      category: { $in: activeCategoryIds },
    };
    const [products, total] = await Promise.all([
      Product.find(filter)
        .populate("category", "name slug")
        .populate("vendor", "storeName slug")
        .sort({ createdAt: -1 })
        .limit(48)
        .lean(),
      Product.countDocuments(filter),
    ]);
    return res.json({ success: true, data: { vendor, products, total } });
  } catch (error) {
    console.error("Get public vendor storefront error:", error);
    return res.status(500).json({ success: false, message: "Could not load this store." });
  }
};

export const getVendorOrders = async (req, res) => {
  try {
    const orders = await Order.find({ "vendorOrders.vendor": req.vendor._id })
      .sort({ placedAt: -1 })
      .limit(100)
      .lean();
    const data = orders.flatMap((order) =>
      order.vendorOrders
        .filter((vendorOrder) => vendorOrder.vendor.toString() === req.vendor._id.toString())
        .map((vendorOrder) => ({
          _id: vendorOrder._id,
          orderId: order._id,
          orderNumber: order.orderNumber,
          placedAt: order.placedAt,
          paymentMethod: order.paymentMethod,
          paymentStatus: order.paymentStatus,
          fulfillmentStatus: vendorOrder.fulfillmentStatus,
          trackingNumber: vendorOrder.trackingNumber || "",
          trackingUrl: vendorOrder.trackingUrl || "",
          settlementStatus: vendorOrder.settlementStatus,
          subtotal: vendorOrder.subtotal,
          commissionRate: vendorOrder.commissionRate,
          commissionAmount: vendorOrder.commissionAmount,
          payableAmount: vendorOrder.payableAmount,
          items: vendorOrder.items,
          shippingAddress: order.shippingAddress,
          returnRequest: order.returnRequest?.status && order.returnRequest.status !== "none"
            ? {
                status: order.returnRequest.status,
                reason: order.returnRequest.reason,
                details: order.returnRequest.details,
                requestedAt: order.returnRequest.requestedAt,
              }
            : null,
        })),
    );
    return res.json({ success: true, data });
  } catch (error) {
    console.error("Get vendor orders error:", error);
    return res.status(500).json({ success: false, message: "Could not load your orders." });
  }
};

export const updateVendorFulfillment = async (req, res) => {
  const { status, trackingNumber, trackingUrl } = req.body ?? {};
  const nextStatusByCurrent = {
    confirmed: "processing",
    processing: "shipped",
    shipped: "delivered",
  };
  if (!["processing", "shipped", "delivered"].includes(status)) {
    return res.status(400).json({ success: false, message: "Invalid fulfillment status." });
  }
  if (trackingNumber !== undefined && (typeof trackingNumber !== "string" || trackingNumber.trim().length > 120)) {
    return res.status(400).json({ success: false, message: "Tracking number must be 120 characters or fewer." });
  }
  if (trackingUrl !== undefined && (typeof trackingUrl !== "string" || trackingUrl.trim().length > 500)) {
    return res.status(400).json({ success: false, message: "Tracking link must be 500 characters or fewer." });
  }
  if (status !== "shipped" && (trackingNumber !== undefined || trackingUrl !== undefined)) {
    return res.status(400).json({ success: false, message: "Shipment tracking details can only be set when marking an order shipped." });
  }
  if (trackingUrl?.trim()) {
    try {
      const url = new URL(trackingUrl.trim());
      if (!["http:", "https:"].includes(url.protocol)) throw new Error("Unsupported protocol");
    } catch {
      return res.status(400).json({ success: false, message: "Enter a valid http or https tracking link." });
    }
  }
  if (!isValidObjectId(req.params.vendorOrderId)) {
    return res.status(400).json({ success: false, message: "Invalid vendor order ID." });
  }
  try {
    const order = await Order.findOne({
      vendorOrders: {
        $elemMatch: {
          _id: req.params.vendorOrderId,
          vendor: req.vendor._id,
        },
      },
    });
    if (!order) {
      return res.status(404).json({ success: false, message: "Vendor order not found." });
    }
    const vendorOrder = order.vendorOrders.id(req.params.vendorOrderId);
    if (order.paymentMethod !== "cod" && order.paymentStatus !== "paid") {
      return res.status(409).json({ success: false, message: "Online payment must be confirmed before fulfillment." });
    }
    if (nextStatusByCurrent[vendorOrder.fulfillmentStatus] !== status) {
      return res.status(409).json({
        success: false,
        message: `Cannot move fulfillment from ${vendorOrder.fulfillmentStatus} to ${status}.`,
      });
    }
    vendorOrder.fulfillmentStatus = status;
    if (status === "shipped") {
      if (trackingNumber !== undefined) vendorOrder.trackingNumber = trackingNumber.trim();
      if (trackingUrl !== undefined) vendorOrder.trackingUrl = trackingUrl.trim();
    }
    const statuses = order.vendorOrders.map((entry) => entry.fulfillmentStatus);
    const activeStatuses = statuses.filter((value) => value !== "cancelled");
    if (!activeStatuses.length) {
      order.orderStatus = "cancelled";
    } else if (activeStatuses.every((value) => value === "delivered")) {
      order.orderStatus = "delivered";
      order.deliveredAt = order.deliveredAt || new Date();
      if (order.paymentMethod === "cod") order.paymentStatus = "paid";
    } else {
      const progress = ["pending", "confirmed", "processing", "shipped", "delivered"];
      order.orderStatus = activeStatuses.reduce(
        (leastAdvanced, value) => progress.indexOf(value) < progress.indexOf(leastAdvanced) ? value : leastAdvanced,
        "delivered",
      );
    }
    await order.save();
    if (["shipped", "delivered"].includes(status)) {
      void notifyCustomerOrder({
        order,
        eventKey: `order:${order._id}:vendor-${vendorOrder._id}:${status}`,
        title: status === "shipped" ? "A seller shipped your order" : "A seller delivered your order",
        message: `${vendorOrder.storeName} marked its items in order ${order.orderNumber} as ${status}.`,
        subject: `Delivery update for order ${order.orderNumber}`,
      });
    }
    return res.json({
      success: true,
      data: {
        vendorOrderId: vendorOrder._id,
        fulfillmentStatus: status,
        trackingNumber: vendorOrder.trackingNumber,
        trackingUrl: vendorOrder.trackingUrl,
      },
    });
  } catch (error) {
    console.error("Update vendor fulfillment error:", error);
    return res.status(500).json({ success: false, message: "Could not update fulfillment." });
  }
};

export const updateVendorProfile = async (req, res) => {
  const updates = {};
  for (const field of ["storeName", "description", "contactEmail", "phone"]) {
    if (req.body?.[field] !== undefined) updates[field] = req.body[field];
  }
  if (!Object.keys(updates).length) {
    return res.status(400).json({ success: false, message: "Provide at least one profile field." });
  }
  if (
    (updates.storeName !== undefined && (typeof updates.storeName !== "string" || updates.storeName.trim().length < 2 || updates.storeName.trim().length > 100)) ||
    (updates.description !== undefined && (typeof updates.description !== "string" || updates.description.length > 1000)) ||
    (updates.contactEmail !== undefined && (typeof updates.contactEmail !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updates.contactEmail.trim()))) ||
    (updates.phone !== undefined && (typeof updates.phone !== "string" || updates.phone.length > 30))
  ) {
    return res.status(400).json({ success: false, message: "Invalid store profile values." });
  }
  for (const field of ["storeName", "description", "contactEmail", "phone"]) {
    if (updates[field] !== undefined) updates[field] = updates[field].trim();
  }
  if (updates.contactEmail) updates.contactEmail = updates.contactEmail.toLowerCase();
  try {
    const vendor = await Vendor.findByIdAndUpdate(req.vendor._id, { $set: updates }, { new: true, runValidators: true })
      .select("storeName slug description contactEmail phone status");
    return res.json({ success: true, data: vendor });
  } catch (error) {
    console.error("Update vendor profile error:", error);
    return res.status(500).json({ success: false, message: "Could not update store profile." });
  }
};

export const getVendorReport = async (req, res) => {
  const { startDate, endDate } = req.query;
  if (
    (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) ||
    (endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate))
  ) {
    return res.status(400).json({ success: false, message: "Dates must use YYYY-MM-DD format." });
  }
  const start = startDate ? new Date(`${startDate}T00:00:00.000Z`) : new Date(Date.now() - 30 * 86400000);
  const end = endDate ? new Date(`${endDate}T23:59:59.999Z`) : new Date();
  if (
    !Number.isFinite(start.getTime()) ||
    !Number.isFinite(end.getTime()) ||
    (startDate && start.toISOString().slice(0, 10) !== startDate) ||
    (endDate && end.toISOString().slice(0, 10) !== endDate) ||
    start > end ||
    end > new Date(Date.now() + 86400000)
  ) {
    return res.status(400).json({ success: false, message: "Provide a valid date range." });
  }
  try {
    const orders = await Order.find({
      placedAt: { $gte: start, $lte: end },
      "vendorOrders.vendor": req.vendor._id,
    }).select("vendorOrders placedAt paymentStatus orderStatus refundStatus totalAmount returnRequest.status returnRequest.refundAmount").lean();
    const rows = orders.flatMap((order) =>
      order.vendorOrders
        .filter((entry) => entry.vendor.toString() === req.vendor._id.toString())
        .map((entry) => ({
          ...entry,
          paymentStatus: order.paymentStatus,
          orderStatus: order.orderStatus,
          refundStatus: order.refundStatus,
          returnStatus: order.returnRequest?.status || "none",
          returnRefundAmount: order.returnRequest?.refundAmount || 0,
          totalAmount: order.totalAmount,
          placedAt: order.placedAt,
        })),
    );
    const financialRows = rows.filter((row) =>
      ["paid", "partially_refunded"].includes(row.paymentStatus) &&
      row.orderStatus !== "cancelled" &&
      (
        (["none", "rejected"].includes(row.returnStatus) && row.refundStatus === "not_required")
        || (row.returnStatus === "refunded" && row.refundStatus === "processed" && row.returnRefundAmount < row.totalAmount)
      ),
    );
    const totals = financialRows.reduce((result, row) => ({
      orders: result.orders + 1,
      grossSales: result.grossSales + row.subtotal,
      commission: result.commission + row.commissionAmount,
      payable: result.payable + row.payableAmount,
      pendingSettlement: result.pendingSettlement + (row.settlementStatus === "pending" ? row.payableAmount : 0),
    }), { orders: 0, grossSales: 0, commission: 0, payable: 0, pendingSettlement: 0 });
    const collected = financialRows.reduce((sum, row) => sum + row.subtotal, 0);
    const salesByDay = new Map();
    for (const row of financialRows) {
      const date = new Date(row.placedAt).toISOString().slice(0, 10);
      const point = salesByDay.get(date) || { sales: 0, orders: 0 };
      point.sales += row.subtotal;
      point.orders += 1;
      salesByDay.set(date, point);
    }
    const endDay = new Date(end);
    endDay.setUTCHours(0, 0, 0, 0);
    const startDay = new Date(Math.max(start.getTime(), endDay.getTime() - 13 * 86400000));
    startDay.setUTCHours(0, 0, 0, 0);
    const salesTrend = [];
    for (const day = new Date(startDay); day <= endDay; day.setUTCDate(day.getUTCDate() + 1)) {
      const date = day.toISOString().slice(0, 10);
      const point = salesByDay.get(date) || { sales: 0, orders: 0 };
      salesTrend.push({ date, sales: roundMoney(point.sales), orders: point.orders });
    }
    return res.json({
      success: true,
      data: {
        startDate: start.toISOString().slice(0, 10),
        endDate: end.toISOString().slice(0, 10),
        ...Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, typeof value === "number" ? roundMoney(value) : value])),
        paidSales: roundMoney(collected),
        salesTrend,
      },
    });
  } catch (error) {
    console.error("Get vendor report error:", error);
    return res.status(500).json({ success: false, message: "Could not generate your sales report." });
  }
};

export const getVendorSettlements = async (req, res) => {
  try {
    const settlements = await VendorSettlement.find({ vendor: req.vendor._id })
      .sort({ paidAt: -1 })
      .limit(100)
      .lean();
    return res.json({ success: true, data: settlements });
  } catch (error) {
    console.error("Get vendor settlements error:", error);
    return res.status(500).json({ success: false, message: "Could not load settlement history." });
  }
};

export const getAdminVendors = async (_req, res) => {
  try {
    const vendors = await Vendor.find({ isPlatform: false })
      .sort({ createdAt: -1 })
      .populate("owner", "name email isActive")
      .lean();
    const vendorIds = vendors.map((vendor) => vendor._id);
    const productCounts = await Product.aggregate([
      { $match: { vendor: { $in: vendorIds }, isDeleted: false } },
      { $group: { _id: "$vendor", count: { $sum: 1 } } },
    ]);
    const countByVendor = new Map(productCounts.map((item) => [item._id.toString(), item.count]));
    return res.json({
      success: true,
      data: vendors.map((vendor) => ({ ...vendor, productCount: countByVendor.get(vendor._id.toString()) || 0 })),
    });
  } catch (error) {
    console.error("Get admin vendors error:", error);
    return res.status(500).json({ success: false, message: "Could not load vendors." });
  }
};

export const reviewAdminVendor = async (req, res) => {
  const { action, commissionRate } = req.body ?? {};
  const allowedActions = ["approve", "reject", "suspend", "reinstate", "commission"];
  if (!allowedActions.includes(action) || !isValidObjectId(req.params.vendorId)) {
    return res.status(400).json({ success: false, message: "Invalid vendor action or ID." });
  }
  if (action === "commission" && commissionRate !== null && (!Number.isFinite(commissionRate) || commissionRate < 0 || commissionRate > 100 || Math.round(commissionRate * 100) !== commissionRate * 100)) {
    return res.status(400).json({ success: false, message: "Commission must be between 0 and 100, with at most two decimals." });
  }
  let session;
  let vendor;
  try {
    session = await mongoose.startSession();
    await session.withTransaction(async () => {
      vendor = await Vendor.findOne({ _id: req.params.vendorId, isPlatform: false }).session(session);
      if (!vendor) throw new Error("VENDOR_NOT_FOUND");
      if (action === "commission") {
        vendor.commissionRate = commissionRate;
      } else {
        const nextStatus = { approve: "approved", reject: "rejected", suspend: "suspended", reinstate: "approved" }[action];
        const allowedTransitions = {
          approve: ["pending", "rejected"],
          reject: ["pending"],
          suspend: ["approved"],
          reinstate: ["suspended"],
        };
        if (!allowedTransitions[action].includes(vendor.status)) {
          throw new Error("VENDOR_INVALID_TRANSITION");
        }
        vendor.status = nextStatus;
        vendor.reviewedAt = new Date();
        vendor.reviewedBy = req.user.userId;
        const ownerUpdate = nextStatus === "approved"
          ? { role: "vendor", $inc: { authTokenVersion: 1 } }
          : nextStatus === "rejected"
            ? { role: "customer", $inc: { authTokenVersion: 1 } }
            : { $inc: { authTokenVersion: 1 } };
        const ownerResult = await User.updateOne({ _id: vendor.owner }, ownerUpdate, { session });
        if (ownerResult.matchedCount !== 1) throw new Error("VENDOR_OWNER_NOT_FOUND");
      }
      await vendor.save({ session });
    });
    await recordActivity(req.user.userId, `vendor_${action}`, vendor._id, `${vendor.storeName}: ${action}`, {
      commissionRate: action === "commission" ? commissionRate : undefined,
    });
    return res.json({ success: true, data: vendor });
  } catch (error) {
    if (error.message === "VENDOR_NOT_FOUND") return res.status(404).json({ success: false, message: "Vendor not found." });
    if (error.message === "VENDOR_INVALID_TRANSITION") {
      const current = await Vendor.findById(req.params.vendorId).select("status").lean();
      return res.status(409).json({ success: false, message: current ? `Cannot ${action} a ${current.status} vendor.` : "Vendor not found." });
    }
    console.error("Review vendor error:", error);
    return res.status(500).json({ success: false, message: "Could not update vendor." });
  } finally {
    if (session) await session.endSession();
  }
};

export const createPlatformVendorAndMigrate = async (req, res) => {
  try {
    let vendor = await Vendor.findOne({ isPlatform: true });
    let migratedCount = 0;
    if (!vendor) {
      vendor = await Vendor.create({
        owner: req.user.userId,
        storeName: "Platform Store",
        slug: "platform-store",
        description: "Products sold directly by the platform.",
        contactEmail: req.user.email,
        status: "approved",
        isPlatform: true,
      });
    }
    const result = await Product.updateMany(
      { $or: [{ vendor: { $exists: false } }, { vendor: null }] },
      { $set: { vendor: vendor._id } },
    );
    migratedCount = result.modifiedCount;
    await recordActivity(req.user.userId, "platform_vendor_migration", vendor._id, `Platform store ready; assigned ${migratedCount} existing products.`, { migratedCount });
    return res.json({ success: true, data: { vendor, migratedCount } });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "A platform store already exists; refresh and try again." });
    }
    console.error("Create platform vendor error:", error);
    return res.status(500).json({ success: false, message: "Could not set up platform store." });
  }
};

export const getAdminMarketplaceSettings = async (_req, res) => {
  try {
    const settings = await AdminSetting.findOneAndUpdate(
      { key: "store" },
      { $setOnInsert: { key: "store", monthlySalesTarget: 100000, marketplaceCommissionRate: 10 } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).select("marketplaceCommissionRate").lean();
    return res.json({ success: true, data: settings });
  } catch (error) {
    console.error("Get marketplace settings error:", error);
    return res.status(500).json({ success: false, message: "Could not load marketplace settings." });
  }
};

export const updateAdminMarketplaceCommission = async (req, res) => {
  const rate = req.body?.commissionRate;
  if (!Number.isFinite(rate) || rate < 0 || rate > 100 || Math.round(rate * 100) !== rate * 100) {
    return res.status(400).json({ success: false, message: "Commission must be between 0 and 100, with at most two decimals." });
  }
  try {
    const settings = await AdminSetting.findOneAndUpdate(
      { key: "store" },
      { $set: { marketplaceCommissionRate: rate } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    ).select("marketplaceCommissionRate").lean();
    await recordActivity(req.user.userId, "marketplace_commission_updated", settings._id, `Default marketplace commission set to ${rate}%.`, { commissionRate: rate });
    return res.json({ success: true, data: settings });
  } catch (error) {
    console.error("Update marketplace commission error:", error);
    return res.status(500).json({ success: false, message: "Could not update marketplace commission." });
  }
};

export const getAdminMarketplaceSettlements = async (_req, res) => {
  try {
    const returnWindowClosedAt = new Date(Date.now() - 30 * 86400000);
    const [orders, history] = await Promise.all([
      Order.find({
        paymentStatus: { $in: ["paid", "partially_refunded"] },
        orderStatus: "delivered",
        deliveredAt: { $lte: returnWindowClosedAt },
        ...eligibleSettlementReturn,
        "vendorOrders.fulfillmentStatus": "delivered",
        "vendorOrders.settlementStatus": "pending",
        "vendorOrders.payableAmount": { $gt: 0 },
      })
        .select("orderNumber placedAt vendorOrders")
        .populate("vendorOrders.vendor", "storeName isPlatform")
        .sort({ placedAt: 1 })
        .limit(500)
        .lean(),
      VendorSettlement.find().populate("vendor", "storeName").sort({ paidAt: -1 }).limit(100).lean(),
    ]);
    const available = orders.flatMap((order) =>
      order.vendorOrders
        .filter((entry) => !entry.vendor?.isPlatform && entry.settlementStatus === "pending" && entry.fulfillmentStatus === "delivered")
        .map((entry) => ({
          orderId: order._id,
          vendorOrderId: entry._id,
          orderNumber: order.orderNumber,
          placedAt: order.placedAt,
          vendorId: entry.vendor?._id,
          storeName: entry.vendor?.storeName || entry.storeName,
          payableAmount: entry.payableAmount,
          items: entry.items,
        })),
    );
    return res.json({ success: true, data: { available, history } });
  } catch (error) {
    console.error("Get marketplace settlements error:", error);
    return res.status(500).json({ success: false, message: "Could not load marketplace settlements." });
  }
};

export const recordAdminVendorSettlement = async (req, res) => {
  const { vendorId, vendorOrders, reference } = req.body ?? {};
  if (!isValidObjectId(vendorId) || !Array.isArray(vendorOrders) || !vendorOrders.length || vendorOrders.length > 100 ||
    typeof reference !== "string" || reference.trim().length < 3 || reference.trim().length > 200) {
    return res.status(400).json({ success: false, message: "Provide a vendor, 1–100 delivered orders, and a payout reference." });
  }
  const uniquePairs = new Set();
  for (const item of vendorOrders) {
    if (!isValidObjectId(item?.orderId) || !isValidObjectId(item?.vendorOrderId)) {
      return res.status(400).json({ success: false, message: "Invalid order selection." });
    }
    const pair = `${item.orderId}:${item.vendorOrderId}`;
    if (uniquePairs.has(pair)) return res.status(400).json({ success: false, message: "Duplicate order selection." });
    uniquePairs.add(pair);
  }
  let session;
  try {
    const vendor = await Vendor.findOne({ _id: vendorId, isPlatform: false });
    if (!vendor) return res.status(404).json({ success: false, message: "Vendor not found." });
    const returnWindowClosedAt = new Date(Date.now() - 30 * 86400000);
    session = await mongoose.startSession();
    let settlement;
    await session.withTransaction(async () => {
      const settlementRows = [];
      let totalPaise = 0;
      for (const selection of vendorOrders) {
        const order = await Order.findOne({
          _id: selection.orderId,
          paymentStatus: { $in: ["paid", "partially_refunded"] },
          orderStatus: "delivered",
          deliveredAt: { $lte: returnWindowClosedAt },
          ...eligibleSettlementReturn,
          vendorOrders: {
            $elemMatch: {
              _id: selection.vendorOrderId,
              vendor: vendor._id,
              fulfillmentStatus: "delivered",
              settlementStatus: "pending",
              payableAmount: { $gt: 0 },
            },
          },
        }).session(session);
        const vendorOrder = order?.vendorOrders.id(selection.vendorOrderId);
        if (!order || !vendorOrder) {
          throw new Error("One or more selected orders are no longer eligible for settlement.");
        }
        totalPaise += Math.round(vendorOrder.payableAmount * 100);
        if (!Number.isSafeInteger(totalPaise)) throw new Error("Settlement total is too large.");
        settlementRows.push({
          order: order._id,
          vendorOrder: vendorOrder._id,
          orderNumber: order.orderNumber,
          amount: vendorOrder.payableAmount,
        });
        vendorOrder.settlementStatus = "paid";
        vendorOrder.settledAt = new Date();
        vendorOrder.settlementReference = reference.trim();
        await order.save({ session });
      }
      [settlement] = await VendorSettlement.create([{
        vendor: vendor._id,
        orders: settlementRows,
        totalAmount: totalPaise / 100,
        reference: reference.trim(),
        paidAt: new Date(),
        recordedBy: req.user.userId,
      }], { session });
    });
    await recordActivity(req.user.userId, "vendor_settlement_recorded", settlement._id, `Recorded a ₹${settlement.totalAmount.toFixed(2)} payout to ${vendor.storeName}.`, {
      vendorId: vendor._id,
      orderCount: settlement.orders.length,
      reference: settlement.reference,
    });
    return res.status(201).json({ success: true, data: settlement });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: "An order in this payout was already settled." });
    if (error.message === "One or more selected orders are no longer eligible for settlement.") {
      return res.status(409).json({ success: false, message: error.message });
    }
    console.error("Record vendor settlement error:", error);
    return res.status(500).json({ success: false, message: "Could not record vendor settlement." });
  } finally {
    if (session) await session.endSession();
  }
};
