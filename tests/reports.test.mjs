import test from "node:test";
import assert from "node:assert/strict";
import {
  pkDay,
  periodPrefix,
  inPeriod,
  summarize,
  monthlyReport,
  dailyReport,
  reportYears,
  reportCsv,
} from "../lib/reports.js";

const order = (createdAt, status, total, shippingFee = 250, discount = 0) => ({
  createdAt,
  status,
  total,
  shippingFee,
  discount,
});

test("dates follow Pakistan time", () => {
  // 20:30 UTC on 30 Sep is already 1 Oct in Karachi (UTC+5).
  assert.equal(pkDay("2026-09-30T20:30:00Z"), "2026-10-01");
  const now = new Date("2026-09-29T10:00:00Z");
  assert.equal(periodPrefix("today", now), "2026-09-29");
  assert.equal(periodPrefix("month", now), "2026-09");
  assert.equal(periodPrefix("year", now), "2026");
  assert.equal(periodPrefix("all", now), "");
  assert.ok(inPeriod(order("2026-09-02T10:00:00Z"), "2026-09"));
  assert.ok(!inPeriod(order("2026-08-31T20:00:00Z"), "2026-08"));
});

test("only delivered orders count as sales", () => {
  const s = summarize([
    order("2026-09-01T10:00:00Z", "Delivered", 2700, 250, 0),
    order("2026-09-02T10:00:00Z", "Delivered", 2150.5, 250, 100),
    order("2026-09-03T10:00:00Z", "Pending", 1000),
    order("2026-09-04T10:00:00Z", "Shipped", 500),
    order("2026-09-05T10:00:00Z", "Cancelled", 9999),
  ]);
  assert.deepEqual(s, {
    key: "",
    orders: 5,
    delivered: 2,
    inProgress: 2,
    cancelled: 1,
    sales: 4850.5,
    itemSales: 4350.5,
    delivery: 500,
    discounts: 100,
    inProgressValue: 1500,
  });
});

test("a year splits into twelve months and a month into its days", () => {
  const orders = [
    order("2026-01-15T10:00:00Z", "Delivered", 1000),
    order("2026-09-29T10:00:00Z", "Delivered", 2000),
    order("2026-09-30T20:30:00Z", "Delivered", 3000), // 1 Oct in Pakistan
    order("2025-12-31T10:00:00Z", "Delivered", 4000),
  ];
  const year = monthlyReport(orders, 2026);
  assert.equal(year.rows.length, 12);
  assert.equal(year.rows[0].sales, 1000);
  assert.equal(year.rows[8].sales, 2000);
  assert.equal(year.rows[9].sales, 3000);
  assert.equal(year.total.sales, 6000);
  const sep = dailyReport(orders, "2026-09");
  assert.equal(sep.rows.length, 30);
  assert.equal(sep.rows[28].key, "2026-09-29");
  assert.equal(sep.rows[28].sales, 2000);
  assert.equal(sep.total.orders, 1);
  assert.equal(dailyReport([], "2028-02").rows.length, 29);
  assert.deepEqual(
    reportYears(orders, new Date("2026-09-29T10:00:00Z")),
    [2026, 2025],
  );
  const csv = reportCsv(year.rows, year.total);
  assert.ok(csv.startsWith("﻿Period,Orders"));
  assert.match(csv, /"September 2026",1,1,0,0,2000,1750,250,0,0/);
  assert.match(csv, /\r\nTotal,3,3,0,0,6000,/);
});
