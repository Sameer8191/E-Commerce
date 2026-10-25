import { createHttpError, moneyToPaise } from "./order.utils.js";

export const calculatePartialReturn = (order, requestedItems) => {
  if (!Array.isArray(requestedItems) || requestedItems.length === 0 || requestedItems.length > 50) {
    throw createHttpError(400, "Select 1–50 items to return");
  }

  const orderLines = new Map((order.items || []).map((item) => [String(item.product), item]));
  const requestedProductIds = new Set();
  const returnItems = [];
  let orderSubtotalPaise = 0;
  let returnSubtotalPaise = 0;

  for (const item of order.items || []) {
    const lineTotal = moneyToPaise(item.price);
    if (lineTotal === null || !Number.isSafeInteger(lineTotal * item.quantity)) {
      throw createHttpError(409, "Order prices are not valid for a return");
    }
    orderSubtotalPaise += lineTotal * item.quantity;
  }

  for (const requested of requestedItems) {
    if (!requested || typeof requested.productId !== "string" || !Number.isSafeInteger(requested.quantity) || requested.quantity < 1) {
      throw createHttpError(400, "Return items must include a valid product and positive quantity");
    }
    if (requestedProductIds.has(requested.productId)) {
      throw createHttpError(400, "A product can only appear once in a return request");
    }
    requestedProductIds.add(requested.productId);

    const orderLine = orderLines.get(requested.productId);
    if (!orderLine || requested.quantity > orderLine.quantity) {
      throw createHttpError(400, "Return quantity exceeds the quantity in this order");
    }
    const unitPricePaise = moneyToPaise(orderLine.price);
    const lineReturnPaise = unitPricePaise * requested.quantity;
    if (!Number.isSafeInteger(lineReturnPaise)) {
      throw createHttpError(400, "Return amount is too large");
    }
    returnSubtotalPaise += lineReturnPaise;
    returnItems.push({
      product: orderLine.product,
      name: orderLine.name,
      price: unitPricePaise / 100,
      quantity: requested.quantity,
    });
  }

  const subtotalPaise = moneyToPaise(order.subtotal);
  const discountPaise = moneyToPaise(order.discount || 0);
  if (
    subtotalPaise === null
    || discountPaise === null
    || subtotalPaise !== orderSubtotalPaise
    || discountPaise > subtotalPaise
  ) {
    throw createHttpError(409, "Order totals are not valid for a return");
  }

  const allocatedDiscountPaise = Number(
    (BigInt(discountPaise) * BigInt(returnSubtotalPaise) + BigInt(subtotalPaise) / 2n)
      / BigInt(subtotalPaise),
  );
  const refundAmountPaise = returnSubtotalPaise - allocatedDiscountPaise;
  if (refundAmountPaise < 1) {
    throw createHttpError(409, "The selected items have no refundable paid value");
  }

  return {
    items: returnItems,
    subtotalPaise: returnSubtotalPaise,
    discountPaise: allocatedDiscountPaise,
    refundAmountPaise,
  };
};
