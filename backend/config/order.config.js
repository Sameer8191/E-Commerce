export const MAX_ORDER_AMOUNT_PAISE = Number(
  process.env.MAX_ORDER_AMOUNT_PAISE ?? 100_000_000,
);
export const RESERVATION_MINUTES = Number(
  process.env.ORDER_RESERVATION_MINUTES ?? 15,
);

if (!Number.isSafeInteger(MAX_ORDER_AMOUNT_PAISE) || MAX_ORDER_AMOUNT_PAISE <= 0) {
  throw new Error("MAX_ORDER_AMOUNT_PAISE must be a positive safe integer");
}

if (!Number.isSafeInteger(RESERVATION_MINUTES) || RESERVATION_MINUTES < 1) {
  throw new Error("ORDER_RESERVATION_MINUTES must be a positive integer");
}
