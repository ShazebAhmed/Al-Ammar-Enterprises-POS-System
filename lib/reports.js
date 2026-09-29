// Sales reports for the admin panel: today, a month, a year, grouped by the order's
// date in Pakistan time. Cash on delivery means money comes in only when an order
// is Delivered, so "sales" counts delivered orders only; orders still on the way
// are shown separately as "in progress", and cancelled ones earn nothing.

// "2026-09-29" for an order placed at that date in Pakistan.
export const pkDay = (value) =>
  new Date(value).toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" });

// The date prefix that a period covers: "2026-09-29", "2026-09", "2026" or "".
export function periodPrefix(period, now = new Date()) {
  const today = pkDay(now);
  if (period === "today") return today;
  if (period === "month") return today.slice(0, 7);
  if (period === "year") return today.slice(0, 4);
  return "";
}

export function inPeriod(order, prefix) {
  return !prefix || pkDay(order.createdAt).startsWith(prefix);
}

const cents = (n) => Math.round((Number(n) || 0) * 100);

// Totals for a list of orders. Money is added in whole paisa, then shown in rupees.
export function summarize(orders, key = "") {
  const c = { sales: 0, items: 0, delivery: 0, discounts: 0, open: 0 };
  const row = { key, orders: 0, delivered: 0, inProgress: 0, cancelled: 0 };
  for (const o of orders) {
    row.orders++;
    if (o.status === "Cancelled") row.cancelled++;
    else if (o.status === "Delivered") {
      row.delivered++;
      c.sales += cents(o.total);
      c.delivery += cents(o.shippingFee);
      c.discounts += cents(o.discount);
      c.items += cents(o.total) - cents(o.shippingFee);
    } else {
      row.inProgress++;
      c.open += cents(o.total);
    }
  }
  return {
    ...row,
    // Cash received for delivered orders (items after discount, plus delivery).
    sales: c.sales / 100,
    // The same without delivery charges: what the goods themselves brought in.
    itemSales: c.items / 100,
    delivery: c.delivery / 100,
    discounts: c.discounts / 100,
    // Value of orders placed but not delivered or cancelled yet.
    inProgressValue: c.open / 100,
  };
}

function group(orders, keys, keyOf) {
  const by = new Map(keys.map((k) => [k, []]));
  for (const o of orders) by.get(keyOf(o))?.push(o);
  return keys.map((k) => summarize(by.get(k), k));
}

// Twelve rows, "2026-01" … "2026-12", plus the year's total.
export function monthlyReport(orders, year) {
  const keys = Array.from(
    { length: 12 },
    (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`,
  );
  const mine = orders.filter((o) => pkDay(o.createdAt).startsWith(`${year}-`));
  return {
    rows: group(mine, keys, (o) => pkDay(o.createdAt).slice(0, 7)),
    total: summarize(mine, String(year)),
  };
}

// One row per day of a month ("2026-09" → "2026-09-01" … "2026-09-30"), plus total.
export function dailyReport(orders, month) {
  const [y, m] = month.split("-").map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const keys = Array.from(
    { length: days },
    (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`,
  );
  const mine = orders.filter((o) => pkDay(o.createdAt).startsWith(`${month}-`));
  return {
    rows: group(mine, keys, (o) => pkDay(o.createdAt)),
    total: summarize(mine, month),
  };
}

// Years that have orders, newest first, always including this year.
export function reportYears(orders, now = new Date()) {
  const years = new Set([Number(pkDay(now).slice(0, 4))]);
  for (const o of orders) years.add(Number(pkDay(o.createdAt).slice(0, 4)));
  return [...years].sort((a, b) => b - a);
}

// "Sep 2026" for "2026-09", "29 Sep" for "2026-09-29".
export function reportLabel(key) {
  const [y, m, d] = key.split("-").map(Number);
  if (!m) return String(y);
  const date = new Date(Date.UTC(y, m - 1, d || 1));
  return d
    ? date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        weekday: "short",
        timeZone: "UTC",
      })
    : date.toLocaleDateString("en-GB", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      });
}

// A spreadsheet of report rows (Excel opens it; the BOM keeps symbols intact).
export function reportCsv(rows, total) {
  const header = [
    "Period",
    "Orders",
    "Delivered",
    "In progress",
    "Cancelled",
    "Sales (delivered)",
    "Items value",
    "Delivery charges",
    "Discounts",
    "In progress value",
  ];
  const line = (r, label) =>
    [
      label,
      r.orders,
      r.delivered,
      r.inProgress,
      r.cancelled,
      r.sales,
      r.itemSales,
      r.delivery,
      r.discounts,
      r.inProgressValue,
    ].join(",");
  return (
    "﻿" +
    [
      header.join(","),
      ...rows.map((r) => line(r, `"${reportLabel(r.key)}"`)),
      line(total, "Total"),
    ].join("\r\n")
  );
}
