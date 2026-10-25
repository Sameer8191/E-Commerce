import crypto from "node:crypto";

const ADDRESS_LIMITS = {
  fullName: 120,
  phone: 30,
  addressLine1: 200,
  addressLine2: 200,
  city: 100,
  state: 100,
  postalCode: 20,
  country: 100,
};

const REQUIRED_ADDRESS_FIELDS = [
  "fullName",
  "phone",
  "addressLine1",
  "city",
  "state",
  "postalCode",
];

export const validAddress = (address) => {
  if (!address || typeof address !== "object" || Array.isArray(address)) {
    return false;
  }

  return (
    REQUIRED_ADDRESS_FIELDS.every((field) => {
      const value = address[field];
      return (
        typeof value === "string" &&
        value.trim().length > 0 &&
        value.trim().length <= ADDRESS_LIMITS[field]
      );
    }) &&
    ["addressLine2", "country"].every((field) => {
      const value = address[field];
      return (
        value === undefined ||
        (typeof value === "string" &&
          value.trim().length <= ADDRESS_LIMITS[field])
      );
    })
  );
};

export const normalizeAddress = (address) => ({
  fullName: address.fullName.trim(),
  phone: address.phone.trim(),
  addressLine1: address.addressLine1.trim(),
  addressLine2: address.addressLine2?.trim() || "",
  city: address.city.trim(),
  state: address.state.trim(),
  postalCode: address.postalCode.trim(),
  country: address.country?.trim().toLowerCase() === "india"
    ? "India"
    : address.country?.trim() || "India",
});

export const isSupportedShippingAddress = (address) =>
  (address?.country?.trim() || "India").toLowerCase() === "india";

export const moneyToPaise = (value) => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }

  const scaled = value * 100;
  const paise = Math.round(scaled);

  if (!Number.isSafeInteger(paise) || Math.abs(scaled - paise) > 1e-7) {
    return null;
  }

  return paise;
};

export const createHttpError = (status, message) => {
  const error = new Error(message);
  error.httpStatus = status;
  return error;
};

export const fingerprintCheckout = ({ shippingAddress, paymentMethod, couponCode = "" }) =>
  crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        shippingAddress: normalizeAddress(shippingAddress),
        paymentMethod,
        couponCode,
      }),
    )
    .digest("hex");

export const sendError = (res, error, fallbackMessage) => {
  if (error.httpStatus) {
    return res.status(error.httpStatus).json({
      success: false,
      message: error.message,
    });
  }

  if (error.name === "ValidationError" || error.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: "Order data is invalid",
    });
  }

  console.error(fallbackMessage, error);

  return res.status(500).json({
    success: false,
    message: fallbackMessage,
  });
};

export const assertSameCheckout = (order, fingerprint) => {
  if (order.checkoutFingerprint !== fingerprint) {
    throw createHttpError(
      409,
      "This Idempotency-Key was already used with different checkout details",
    );
  }
};
