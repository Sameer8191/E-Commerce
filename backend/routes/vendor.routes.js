import express from "express";
import {
  applyToBecomeVendor,
  getMyVendorApplication,
  getPublicVendorStorefront,
  getVendorOrders,
  getVendorProducts,
  getVendorReport,
  getVendorSettlements,
  updateVendorFulfillment,
  updateVendorProfile,
} from "../controllers/vendor.controller.js";
import { requireApprovedVendor, requireAuth } from "../middlewares/auth.middleware.js";

const vendorRoutes = express.Router();

vendorRoutes.get("/store/:slug", getPublicVendorStorefront);
vendorRoutes.use(requireAuth);
vendorRoutes.get("/application", getMyVendorApplication);
vendorRoutes.post("/application", applyToBecomeVendor);
vendorRoutes.use("/me", requireApprovedVendor);
vendorRoutes.get("/me", (req, res) => res.json({
  success: true,
  data: {
    _id: req.vendor._id,
    storeName: req.vendor.storeName,
    slug: req.vendor.slug,
    description: req.vendor.description,
    contactEmail: req.vendor.contactEmail,
    phone: req.vendor.phone,
    commissionRate: req.vendor.commissionRate,
  },
}));
vendorRoutes.patch("/me", updateVendorProfile);
vendorRoutes.get("/me/products", getVendorProducts);
vendorRoutes.get("/me/orders", getVendorOrders);
vendorRoutes.patch("/me/orders/:vendorOrderId/fulfillment", updateVendorFulfillment);
vendorRoutes.get("/me/reports", getVendorReport);
vendorRoutes.get("/me/settlements", getVendorSettlements);

export default vendorRoutes;
