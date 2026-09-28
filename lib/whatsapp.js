import { cartTotals } from "./cart.js";
import { formatMoney } from "./format.js";

// wa.me needs the international number without "+" or leading zeros. Numbers entered the
// Pakistani way (0321…, 0092…, 321…) are converted to 92…; returns "" if it is too short.
export function whatsappPhone(value) {
  let p = String(value || "").replace(/\D/g, "");
  if (p.startsWith("00")) p = p.slice(2);
  else if (p.startsWith("0")) p = "92" + p.slice(1);
  else if (p.length === 10 && p.startsWith("3")) p = "92" + p;
  return p.length >= 10 ? p : "";
}

// lines: [{ product: { name, price }, qty }] as used by the cart page.
export function whatsappOrderMessage(lines, { currencySymbol, shippingFee }) {
  const money = (n) => formatMoney(n, currencySymbol);
  const items = lines.filter((l) => l.product && l.qty > 0);
  const totals = cartTotals(items, shippingFee);
  return [
    "Assalam-o-Alaikum! I would like to order:",
    ...items.map(
      (l) =>
        `• ${l.qty} × ${l.product.name}${l.variant ? ` (${l.variant})` : ""} (${money(l.product.price)} each)`,
    ),
    "",
    `Subtotal: ${money(totals.subtotal)}`,
    `Delivery: ${money(totals.shipping)}`,
    `Total: ${money(totals.total)}`,
    "",
    "Name:",
    "Address:",
  ].join("\n");
}

export function whatsappOrderLink(settings, lines) {
  const phone = whatsappPhone(settings?.whatsapp);
  if (!phone || !lines.some((l) => l.product && l.qty > 0)) return "";
  const text = whatsappOrderMessage(lines, settings);
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

// After checkout: lets the customer message the store about the order they just
// placed, so it can be confirmed without waiting for a call.
export function whatsappPlacedOrderLink(settings, order) {
  const phone = whatsappPhone(settings?.whatsapp);
  if (!phone || !order?.id) return "";
  const text = [
    "Assalam-o-Alaikum! I just placed an order on your website.",
    `Order number: ${order.id}`,
    `Total: ${formatMoney(order.total, settings.currencySymbol)} (cash on delivery)`,
    `Name: ${order.customer?.name || ""}`,
  ].join("\n");
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}
