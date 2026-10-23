import dotenv from "dotenv";
dotenv.config();

const BREVO_API_KEY = process.env.BREVO_API_KEY?.trim();
const SENDER_EMAIL = process.env.EMAIL_USER?.trim();

// Reusable email sender function
const sendEmail = async ({ to, subject, htmlContent, textContent }) => {
  try {
    if (!BREVO_API_KEY || !SENDER_EMAIL) {
      throw new Error(
        "Email Configuration missing (BREVO_API_KEY or EMAIL_USER)",
      );
    }

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": BREVO_API_KEY,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender: { name: "E-Commerce", email: SENDER_EMAIL },
        to,
        subject,
        htmlContent,
        ...(textContent && { textContent }),
      }),
      signal: AbortSignal.timeout(10000), // 10s timeout so Express never hangs
    });

    // Safely parse JSON in case of non-JSON 5xx gateway errors
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        result.message || `Brevo API Error (Status ${response.status})`,
      );
    }

    return result;
  } catch (error) {
    console.error(`Email Error [${subject}]:`, error.message);
    throw error;
  }
};

const otpTemplate = (title, name, otp, message) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px; text-align: center;">
    <h2 style="color: #4f46e5;">${title}</h2>
    <p>Hi ${escapeHtml(name || "User")},</p>
    <p>${message}</p>
    <div style="margin: 30px 0;">
      <span style="font-size: 32px; font-weight: bold; color: #4f46e5; letter-spacing: 5px; background: #f3f4f6; padding: 10px 20px; border-radius: 8px;">${otp}</span>
    </div>
    <p>This code will expire in 10 minutes.</p>
    <p>If you did not request this, please ignore this email.</p>
    <hr style="border: 0; border-top: 1px solid #eeeeee; margin: 20px 0;">
    <p style="font-size: 12px; color: #888888;">&copy; ${new Date().getFullYear()} E-Commerce. All rights reserved.</p>
  </div>
`;

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}[character]));

// Send Verification Email
export const sendVerificationEmail = async (email, name, otp) => {
  const safeName = name?.trim() || "User";
  const message =
    "Thank you for signing up. Please use the following 6-digit code to verify your email address:";

  return sendEmail({
    to: [{ email: email.trim(), name: safeName }],
    subject: "Your Verification Code - E-Commerce",
    htmlContent: otpTemplate("Verify Your Email", safeName, otp, message),
    textContent: `Hi ${safeName}, ${message} ${otp}. This code will expire in 10 minutes.`,
  });
};

// Send Forgot Password Email (Fixed missing htmlContent)
export const sendForgotPasswordEmail = async (email, name, otp) => {
  const safeName = name?.trim() || "User";
  const message =
    "We received a request to reset your password. Please use the following 6-digit code to proceed:";

  return sendEmail({
    to: [{ email: email.trim(), name: safeName }],
    subject: "Reset Your Password - E-Commerce",
    htmlContent: otpTemplate("Reset Your Password", safeName, otp, message),
    textContent: `Hi ${safeName}, ${message} ${otp}. This code will expire in 10 minutes.`,
  });
};
