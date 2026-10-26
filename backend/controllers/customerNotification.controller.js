import mongoose from "mongoose";
import CustomerNotification from "../models/customer-notification.model.js";

export const getMyNotifications = async (req, res) => {
  try {
    const [notifications, unreadCount] = await Promise.all([
      CustomerNotification.find({ user: req.user.userId }).sort({ createdAt: -1 }).limit(100).lean(),
      CustomerNotification.countDocuments({ user: req.user.userId, readAt: null }),
    ]);
    return res.json({ success: true, data: notifications, unreadCount });
  } catch (error) {
    console.error("Get customer notifications error:", error);
    return res.status(500).json({ success: false, message: "Could not load notifications." });
  }
};

export const markMyNotificationRead = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.notificationId)) return res.status(400).json({ success: false, message: "Invalid notification ID." });
    const notification = await CustomerNotification.findOneAndUpdate(
      { _id: req.params.notificationId, user: req.user.userId, readAt: null },
      { $set: { readAt: new Date() } },
      { new: true },
    );
    if (!notification) {
      const exists = await CustomerNotification.exists({ _id: req.params.notificationId, user: req.user.userId });
      return res.status(exists ? 200 : 404).json({ success: Boolean(exists), message: exists ? "Notification already read." : "Notification not found." });
    }
    return res.json({ success: true, data: notification });
  } catch (error) {
    console.error("Mark customer notification read error:", error);
    return res.status(500).json({ success: false, message: "Could not update this notification." });
  }
};
