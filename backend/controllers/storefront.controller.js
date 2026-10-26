import Product from "../models/product.model.js";
import NewsletterSubscriber from "../models/newsletterSubscriber.model.js";
import StockAlert from "../models/stockAlert.model.js";
import { sendEmail } from "../services/emailService.js";
import User from "../models/user.model.js";
import Order from "../models/order.model.js";
import Review from "../models/review.model.js";
export const notifyStockRestock = async (product) => {
  if (!product?._id || Number(product.stock) <= 0) return;
  const alerts = await StockAlert.find({ product: product._id, notifiedAt: null }).limit(500).lean();
  for (const alert of alerts) {
    try {
      await sendEmail({ to: [{ email: alert.email }], subject: `${product.name} is back in stock`, htmlContent: `<p>${String(product.name).replace(/[&<>"']/g, "") } is available again. Visit the store to order while stock lasts.</p>`, textContent: `${product.name} is back in stock. Visit the store to order while stock lasts.` });
      await StockAlert.updateOne({ _id: alert._id, notifiedAt: null }, { $set: { notifiedAt: new Date() } });
    } catch (error) {
      console.error("Stock alert email failed:", error.message);
    }
  }
};

export const retryPendingStockAlerts = async () => {
  const alerts = await StockAlert.find({ notifiedAt: null }).populate({ path: "product", select: "name stock isActive isDeleted" }).limit(100);
  let sent = 0;
  for (const alert of alerts) {
    if (alert.product?.isActive && !alert.product.isDeleted && Number(alert.product.stock) > 0) {
      const before = await StockAlert.countDocuments({ product: alert.product._id, notifiedAt: null });
      await notifyStockRestock(alert.product);
      const after = await StockAlert.countDocuments({ product: alert.product._id, notifiedAt: null });
      sent += Math.max(0, before - after);
    }
  }
  return { examined: alerts.length, sent };
};

const validEmail = (email) => typeof email === "string" && email.trim().length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);

export const sendContactMessage = async (req, res) => {
  const { name, email, orderNumber = "", subject, message } = req.body ?? {};
  if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 80 || !validEmail(email) || typeof subject !== "string" || subject.trim().length < 3 || subject.trim().length > 120 || typeof message !== "string" || message.trim().length < 10 || message.trim().length > 4000 || (typeof orderNumber !== "string" || orderNumber.trim().length > 80)) return res.status(400).json({ success: false, message: "Please complete each field with valid information." });
  const recipient = process.env.SUPPORT_EMAIL?.trim() || process.env.EMAIL_USER?.trim();
  if (!recipient) return res.status(503).json({ success: false, message: "Customer support email is not configured. Email help@goodthings.shop instead." });
  try {
    const safe = { name: escapeHtml(name.trim()), email: escapeHtml(email.trim()), orderNumber: escapeHtml(orderNumber.trim() || "Not provided"), subject: escapeHtml(subject.trim()), message: escapeHtml(message.trim()).replace(/\n/g, "<br>") };
    const safeSubject = subject.trim().replace(/[\r\n]/g, " ").slice(0, 100);
    await sendEmail({ to: [{ email: recipient }], subject: `Customer message: ${safeSubject}`, htmlContent: `<h2>${safe.subject}</h2><p><b>From:</b> ${safe.name} (${safe.email})</p><p><b>Order:</b> ${safe.orderNumber}</p><p>${safe.message}</p>`, textContent: `From: ${name.trim()} (${email.trim()})\nOrder: ${orderNumber.trim() || "Not provided"}\n\n${message.trim()}` });
    return res.status(200).json({ success: true, message: "Your message has been sent. Customer care will follow up by email." });
  } catch (error) {
    console.error("Customer contact email failed:", error.message);
    return res.status(503).json({ success: false, message: "Your message could not be sent. Please email help@goodthings.shop." });
  }
};

export const exportMyData = async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.user.userId, isActive: true }).select("name email phone avatar role addresses isVerified createdAt").lean();
    if (!user) return res.status(404).json({ success: false, message: "Account not found." });
    const [orders, reviews, newsletter] = await Promise.all([
      Order.find({ user: req.user.userId }).select("orderNumber items shippingAddress subtotal shippingFee discount couponCode totalAmount currency paymentMethod paymentStatus orderStatus returnRequest placedAt createdAt updatedAt").sort({ placedAt: -1 }).lean(),
      Review.find({ user: req.user.userId }).select("product rating title comment isVerifiedPurchase createdAt updatedAt").sort({ createdAt: -1 }).lean(),
      NewsletterSubscriber.findOne({ email: user.email }).select("email consentedAt createdAt").lean(),
    ]);
    return res.json({ success: true, data: { exportedAt: new Date().toISOString(), profile: user, orders, reviews, newsletter: newsletter ? { subscribed: true, consentedAt: newsletter.consentedAt } : { subscribed: false } } });
  } catch (error) {
    console.error("Customer data export failed:", error);
    return res.status(500).json({ success: false, message: "Could not prepare your data export." });
  }
};

export const subscribeNewsletter = async (req, res) => {
  const email = req.body?.email;
  if (!validEmail(email) || req.body?.consent !== true) return res.status(400).json({ success: false, message: "Enter a valid email and confirm newsletter consent." });
  try {
    const result = await NewsletterSubscriber.updateOne({ email: email.trim().toLowerCase() }, { $setOnInsert: { email: email.trim().toLowerCase(), consentedAt: new Date() } }, { upsert: true });
    return res.status(200).json({ success: true, message: result.upsertedCount ? "You’re on the list. Thanks for subscribing!" : "This email is already subscribed." });
  } catch (error) {
    console.error("Newsletter subscription failed:", error);
    return res.status(500).json({ success: false, message: "Subscription could not be saved. Please try again." });
  }
};

export const unsubscribeNewsletter = async (req, res) => {
  const email = req.body?.email;
  if (!validEmail(email)) return res.status(400).json({ success: false, message: "Enter a valid email address." });
  try {
    await NewsletterSubscriber.deleteOne({ email: email.trim().toLowerCase() });
    return res.json({ success: true, message: "You’ve been removed from the newsletter list." });
  } catch (error) {
    console.error("Newsletter unsubscribe failed:", error);
    return res.status(500).json({ success: false, message: "Could not update your subscription. Please try again." });
  }
};

export const createStockAlert = async (req, res) => {
  const { productId } = req.params;
  const email = req.body?.email;
  if (!validEmail(email)) return res.status(400).json({ success: false, message: "Enter a valid email address." });
  try {
    const product = await Product.findOne({ _id: productId, isActive: true, isDeleted: false }).select("stock");
    if (!product) return res.status(404).json({ success: false, message: "Product not found." });
    if (product.stock > 0) return res.status(409).json({ success: false, message: "This product is back in stock. Refresh the page to order it." });
    await StockAlert.updateOne({ product: productId, email: email.trim().toLowerCase() }, { $setOnInsert: { product: productId, email: email.trim().toLowerCase() }, $set: { notifiedAt: null } }, { upsert: true });
    return res.status(201).json({ success: true, message: "We’ll email you when this item is back in stock." });
  } catch (error) {
    if (error.code === 11000) return res.status(200).json({ success: true, message: "You’re already signed up for a stock alert." });
    console.error("Stock alert signup failed:", error);
    return res.status(500).json({ success: false, message: "Could not save your alert. Please try again." });
  }
};
