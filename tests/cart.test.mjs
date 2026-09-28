import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeCart,
  mergeCarts,
  changeQuantity,
  cartTotals,
  validateCustomer,
  lineStock,
  saveBuyNow,
  readBuyNow,
  clearBuyNow,
} from "../lib/cart.js";
test("buy now keeps one clean line apart from the basket", () => {
  const store = new Map();
  globalThis.sessionStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  try {
    assert.equal(readBuyNow(), null);
    saveBuyNow({ productId: "p1", variant: " M ", qty: 2 });
    assert.deepEqual(readBuyNow(), [{ productId: "p1", variant: "M", qty: 2 }]);
    // Tampered storage cannot sneak in more lines or bad quantities.
    store.set(
      "al-ammar:buy-now",
      JSON.stringify([
        { productId: "p1", qty: -1 },
        { productId: "p2", qty: 1 },
        { productId: "p3", qty: 1 },
      ]),
    );
    assert.deepEqual(readBuyNow(), [{ productId: "p2", qty: 1 }]);
    store.set("al-ammar:buy-now", "not json");
    assert.equal(readBuyNow(), null);
    clearBuyNow();
    assert.equal(readBuyNow(), null);
  } finally {
    delete globalThis.sessionStorage;
  }
});
test("each product option is its own basket line with its own stock", () => {
  const cart = normalizeCart([
    { productId: "a", variant: "M", qty: 1 },
    { productId: "a", variant: "L", qty: 2 },
    { productId: "a", variant: "M", qty: 1 },
    { productId: "b", qty: 1 },
  ]);
  assert.deepEqual(cart, [
    { productId: "a", variant: "M", qty: 2 },
    { productId: "a", variant: "L", qty: 2 },
    { productId: "b", qty: 1 },
  ]);
  const next = changeQuantity(cart, "a", 0, 5, "M");
  assert.deepEqual(next, [
    { productId: "a", variant: "L", qty: 2 },
    { productId: "b", qty: 1 },
  ]);
  const shirt = {
    stock: 7,
    variants: [
      { name: "M", stock: 3 },
      { name: "L", stock: 4 },
    ],
  };
  assert.equal(lineStock(shirt, "L"), 4);
  assert.equal(lineStock(shirt, ""), 0); // an option must be chosen
  assert.equal(lineStock(shirt, "XL"), 0);
  assert.equal(lineStock({ stock: 5, variants: [] }, ""), 5);
  assert.equal(lineStock({ stock: 5, variants: [] }, "M"), 0);
});
import {
  formatMoney,
  productFromRow,
  orderFromRow,
  getVideoEmbed,
} from "../lib/format.js";
test("corrupt cart storage cannot inject fractional, negative, or excessive quantities", () => {
  assert.deepEqual(
    normalizeCart([
      null,
      {},
      { productId: "a", qty: -1 },
      { productId: "a", qty: 1.5 },
      { productId: "b", qty: 999999 },
      { productId: "", qty: 2 },
    ]),
    [{ productId: "b", qty: 999 }],
  );
});
test("guest merge does not mutate server or guest snapshots", () => {
  const saved = [{ productId: "a", qty: 2 }],
    guest = [
      { productId: "a", qty: 1 },
      { productId: "b", qty: 3 },
    ];
  assert.deepEqual(mergeCarts(saved, guest), [
    { productId: "a", qty: 3 },
    { productId: "b", qty: 3 },
  ]);
  assert.equal(saved[0].qty, 2);
  assert.equal(guest[0].qty, 1);
});
test("quantity is stock bounded; zero removes product", () => {
  const cart = [{ productId: "a", qty: 2 }];
  assert.deepEqual(changeQuantity(cart, "a", 50, 3), [
    { productId: "a", qty: 3 },
  ]);
  assert.deepEqual(changeQuantity(cart, "a", 0, 3), []);
  assert.deepEqual(changeQuantity(cart, "a", NaN, 3), cart);
});
test("totals use integer minor units and do not charge shipping on an empty cart", () => {
  assert.deepEqual(
    cartTotals(
      [
        { qty: 3, product: { price: 0.1 } },
        { qty: 1, product: { price: 0.2 } },
      ],
      150.25,
    ),
    { subtotal: 0.5, shipping: 150.25, total: 150.75 },
  );
  assert.deepEqual(cartTotals([], 150), { subtotal: 0, shipping: 0, total: 0 });
  assert.match(formatMoney(10.25, "Rs."), /10\.25/);
});
test("customer details are trimmed and invalid phone numbers rejected", () => {
  const customer = {
    name: "  Ali  ",
    phone: "0300-1234567",
    address: "Street 1",
    city: "Karachi",
  };
  assert.equal(validateCustomer(customer).name, "Ali");
  assert.throws(() => validateCustomer({ ...customer, phone: "abc" }), /phone/);
  assert.throws(() => validateCustomer({ ...customer, city: " " }));
});
test("an option keeps its photo only while it is one of the product's photos", () => {
  const product = productFromRow({
    id: "w",
    price: 2450,
    images: ["https://x/brown.jpg", "https://x/black.webp"],
    option_label: "Colour",
    variants: [
      { name: "Black", stock: 8, image: "https://x/black.webp" },
      { name: "Brown", stock: 7, image: "https://x/removed.jpg" },
      { name: "Tan", stock: 1 },
    ],
  });
  assert.deepEqual(product.variants, [
    { name: "Black", stock: 8, image: "https://x/black.webp" },
    { name: "Brown", stock: 7 },
    { name: "Tan", stock: 1 },
  ]);
});
test("database numerics are normalized before calculating revenue", () => {
  assert.equal(
    productFromRow({ id: "a", price: "19.99", stock: "3" }).price,
    19.99,
  );
  assert.equal(orderFromRow({ total: "102.5", items: null }).total, 102.5);
  assert.deepEqual(orderFromRow({}).items, []);
});
test("video embedding checks trusted YouTube host and safe direct media URLs", () => {
  assert.equal(
    getVideoEmbed("https://evil.test/youtube.com/watch?v=dQw4w9WgXcQ"),
    null,
  );
  assert.deepEqual(getVideoEmbed("https://youtu.be/dQw4w9WgXcQ"), {
    type: "youtube",
    id: "dQw4w9WgXcQ",
  });
  assert.equal(getVideoEmbed("javascript:alert(1)"), null);
  assert.equal(getVideoEmbed("https://example.test/file.mp4").type, "file");
});
