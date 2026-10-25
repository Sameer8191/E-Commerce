import test from "node:test";
import assert from "node:assert/strict";
import { calculatePartialReturn } from "../utils/return.utils.js";

test("allocates coupon discounts proportionally to returned item value", () => {
  const result = calculatePartialReturn({
    items: [
      { product: "product-one", name: "First", price: 100, quantity: 1 },
      { product: "product-two", name: "Second", price: 100, quantity: 1 },
    ],
    subtotal: 200,
    discount: 20,
  }, [{ productId: "product-one", quantity: 1 }]);

  assert.equal(result.subtotalPaise, 10000);
  assert.equal(result.discountPaise, 1000);
  assert.equal(result.refundAmountPaise, 9000);
});

test("refunds the full discounted order value when every item is returned", () => {
  const result = calculatePartialReturn({
    items: [{ product: "product-one", name: "First", price: 99.99, quantity: 2 }],
    subtotal: 199.98,
    discount: 19.99,
  }, [{ productId: "product-one", quantity: 2 }]);

  assert.equal(result.refundAmountPaise, 17999);
});

test("rejects a return quantity that exceeds the purchased quantity", () => {
  assert.throws(
    () => calculatePartialReturn({
      items: [{ product: "product-one", name: "First", price: 100, quantity: 1 }],
      subtotal: 100,
      discount: 0,
    }, [{ productId: "product-one", quantity: 2 }]),
    { httpStatus: 400 },
  );
});

test("rejects duplicate product entries", () => {
  assert.throws(
    () => calculatePartialReturn({
      items: [{ product: "product-one", name: "First", price: 100, quantity: 2 }],
      subtotal: 200,
      discount: 0,
    }, [
      { productId: "product-one", quantity: 1 },
      { productId: "product-one", quantity: 1 },
    ]),
    { httpStatus: 400 },
  );
});
