export function normalizeCart(lines) {
  const map = new Map();
  for (const line of Array.isArray(lines) ? lines : []) {
    if (!line || typeof line.productId !== "string" || !line.productId.trim())
      continue;
    const qty = Number(line.qty);
    if (!Number.isSafeInteger(qty) || qty <= 0) continue;
    map.set(
      line.productId,
      Math.min(999, (map.get(line.productId) || 0) + qty),
    );
  }
  return [...map].map(([productId, qty]) => ({ productId, qty }));
}
export function mergeCarts(a, b) {
  return normalizeCart([...(a || []), ...(b || [])]);
}
export function changeQuantity(cart, productId, qty, stock = 999) {
  const limit = Math.max(0, Math.min(999, Math.floor(Number(stock) || 0)));
  if (!Number.isFinite(Number(qty))) return cart;
  const next = Math.max(0, Math.min(limit, Math.floor(Number(qty))));
  const rest = cart.filter((line) => line.productId !== productId);
  return next ? [...rest, { productId, qty: next }] : rest;
}
export function cartTotals(lines, shippingFee = 0) {
  const subtotalCents = lines.reduce(
    (sum, line) =>
      sum + Math.round(Number(line.product.price) * 100) * line.qty,
    0,
  );
  const shippingCents = lines.length
    ? Math.max(0, Math.round(Number(shippingFee || 0) * 100))
    : 0;
  return {
    subtotal: subtotalCents / 100,
    shipping: shippingCents / 100,
    total: (subtotalCents + shippingCents) / 100,
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
