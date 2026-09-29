// A basket line is { productId, qty } or, for a product with options (size,
// colour), { productId, variant, qty }. Each option is its own line.
export function sameLine(line, productId, variant = "") {
  return line.productId === productId && (line.variant || "") === variant;
}
export function normalizeCart(lines) {
  const map = new Map();
  for (const line of Array.isArray(lines) ? lines : []) {
    if (!line || typeof line.productId !== "string" || !line.productId.trim())
      continue;
    const qty = Number(line.qty);
    if (!Number.isSafeInteger(qty) || qty <= 0) continue;
    const variant =
      typeof line.variant === "string" ? line.variant.trim().slice(0, 40) : "";
    const key = JSON.stringify([line.productId, variant]);
    map.set(key, {
      productId: line.productId,
      ...(variant && { variant }),
      qty: Math.min(999, (map.get(key)?.qty || 0) + qty),
    });
  }
  return [...map.values()];
}
// How many of a basket line's product can be ordered: the chosen option's stock,
// or the product's stock when it has no options.
export function lineStock(product, variant = "") {
  if (!product) return 0;
  const options = product.variants || [];
  if (options.length)
    return variant ? options.find((v) => v.name === variant)?.stock || 0 : 0;
  return variant ? 0 : Math.max(0, Number(product.stock) || 0);
}
// "Buy now": one line checked out on its own. It is kept for this tab only and
// never touches the basket.
const BUY_NOW_KEY = "al-ammar:buy-now";
export function saveBuyNow(line) {
  try {
    sessionStorage.setItem(BUY_NOW_KEY, JSON.stringify(normalizeCart([line])));
  } catch {}
}
export function readBuyNow() {
  try {
    const lines = normalizeCart(
      JSON.parse(sessionStorage.getItem(BUY_NOW_KEY) || "null"),
    ).slice(0, 1);
    return lines.length ? lines : null;
  } catch {
    return null;
  }
}
export function clearBuyNow() {
  try {
    sessionStorage.removeItem(BUY_NOW_KEY);
  } catch {}
}
export function mergeCarts(a, b) {
  return normalizeCart([...(a || []), ...(b || [])]);
}
export function changeQuantity(
  cart,
  productId,
  qty,
  stock = 999,
  variant = "",
) {
  const limit = Math.max(0, Math.min(999, Math.floor(Number(stock) || 0)));
  if (!Number.isFinite(Number(qty))) return cart;
  const next = Math.max(0, Math.min(limit, Math.floor(Number(qty))));
  const rest = cart.filter((line) => !sameLine(line, productId, variant));
  return next
    ? [...rest, { productId, ...(variant && { variant }), qty: next }]
    : rest;
}
// freeOver: delivery is free once the items, after the discount, reach this amount
// (0 = never). freeLeft is how much more is needed for that.
export function cartTotals(lines, shippingFee = 0, freeOver = 0, discount = 0) {
  const subtotalCents = lines.reduce(
    (sum, line) =>
      sum + Math.round(Number(line.product.price) * 100) * line.qty,
    0,
  );
  const freeCents = Math.max(0, Math.round(Number(freeOver || 0) * 100));
  const spentCents = subtotalCents - Math.round(Number(discount || 0) * 100);
  const free = freeCents > 0 && spentCents >= freeCents;
  const shippingCents =
    lines.length && !free
      ? Math.max(0, Math.round(Number(shippingFee || 0) * 100))
      : 0;
  return {
    subtotal: subtotalCents / 100,
    shipping: shippingCents / 100,
    total: (subtotalCents + shippingCents) / 100,
    freeLeft:
      freeCents > 0 && shippingCents > 0 ? (freeCents - spentCents) / 100 : 0,
  };
}
export function validateCustomer(customer) {
  const limits = { name: 120, phone: 30, address: 500, city: 100, notes: 1000 };
  const clean = Object.fromEntries(
    Object.entries(limits).map(([key]) => [
      key,
      String(customer?.[key] || "").trim(),
    ]),
  );
  for (const [key, max] of Object.entries(limits)) {
    if (key !== "notes" && !clean[key])
      throw new Error("Please complete all delivery details.");
    if (clean[key].length > max) throw new Error(`${key} is too long.`);
  }
  if (!/^\+?[\d\s()-]{7,30}$/.test(clean.phone))
    throw new Error("Please enter a valid phone number.");
  return clean;
}
