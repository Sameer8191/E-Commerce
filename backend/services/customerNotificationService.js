import CustomerNotification from "../models/customer-notification.model.js";
import User from "../models/user.model.js";
import { sendEmail } from "./emailService.js";

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}[character]));

export const deliverCustomerNotificationEmail = async (notification, recipient) => {
  const now = new Date();
  const staleSendingBefore = new Date(now.getTime() - 10 * 60_000);
  const claimed = await CustomerNotification.findOneAndUpdate(
    {
      _id: notification._id,
      emailAttempts: { $lt: 8 },
      $or: [
        { emailStatus: { $in: ["pending", "failed"] }, nextEmailAttemptAt: { $lte: now } },
        { emailStatus: "sending", updatedAt: { $lte: staleSendingBefore } },
      ],
    },
    { $set: { emailStatus: "sending" }, $inc: { emailAttempts: 1 } },
    { new: true },
  );
  if (!claimed) return false;
  const attempts = claimed.emailAttempts;
  try {
    await sendEmail({
      to: [{ email: recipient.email, name: recipient.name }],
      subject: notification.emailSubject,
      htmlContent: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px"><h2>${escapeHtml(notification.title)}</h2><p>${escapeHtml(notification.message)}</p><p>View your order updates in your Goodthings account.</p></div>`,
      textContent: `${notification.title}\n\n${notification.message}\n\nView your order updates in your Goodthings account.`,
    });
    await CustomerNotification.updateOne(
      { _id: notification._id, emailStatus: "sending" },
      { $set: { emailStatus: "sent", emailError: "", nextEmailAttemptAt: null } },
    );
    return true;
  } catch (error) {
    const delayMinutes = Math.min(360, 5 * 2 ** Math.min(attempts - 1, 6));
    await CustomerNotification.updateOne(
      { _id: notification._id, emailStatus: "sending" },
      {
        $set: {
          emailStatus: "failed",
          emailError: String(error.message || error).slice(0, 1000),
          nextEmailAttemptAt: new Date(Date.now() + delayMinutes * 60_000),
        },
      },
    );
    console.error("Customer notification email failed:", { notificationId: String(notification._id), error: error.message });
    return false;
  }
};

export const notifyCustomerOrder = async ({ order, eventKey, title, message, subject }) => {
  if (!order?._id || !order?.user || !eventKey) {
    console.error("Customer notification skipped: order, user, or event key is missing.");
    return;
  }
  try {
    const user = await User.findOne({ _id: order.user, isActive: true }).select("name email").lean();
    if (!user?.email) {
      console.error("Customer notification skipped: active recipient not found.", { orderId: String(order._id) });
      return;
    }
    let notification;
    try {
      [notification] = await CustomerNotification.create([{
        user: user._id,
        order: order._id,
        eventKey,
        title,
        message,
        emailSubject: subject || title,
        nextEmailAttemptAt: new Date(),
      }]);
    } catch (error) {
      if (error.code === 11000) return;
      throw error;
    }
    await deliverCustomerNotificationEmail(notification, user);
  } catch (error) {
    console.error("Create customer notification failed:", { orderId: String(order._id), error });
  }
};

export const retryCustomerNotificationEmails = async () => {
  const staleSendingBefore = new Date(Date.now() - 10 * 60_000);
  const pending = await CustomerNotification.find({
    emailAttempts: { $lt: 8 },
    $or: [
      { emailStatus: { $in: ["pending", "failed"] }, nextEmailAttemptAt: { $lte: new Date() } },
      { emailStatus: "sending", updatedAt: { $lte: staleSendingBefore } },
    ],
  }).sort({ nextEmailAttemptAt: 1 }).limit(100).lean();
  let sent = 0;
  for (const notification of pending) {
    const user = await User.findOne({ _id: notification.user, isActive: true }).select("name email").lean();
    if (!user?.email) {
      console.error("Notification email retry skipped: recipient not found.", { notificationId: String(notification._id) });
      await CustomerNotification.updateOne({ _id: notification._id }, { $set: { emailStatus: "failed", emailError: "Active recipient not found", nextEmailAttemptAt: null } });
      continue;
    }
    if (await deliverCustomerNotificationEmail(notification, user)) sent += 1;
  }
  return { examined: pending.length, sent };
};
