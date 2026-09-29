import test from "node:test";
import assert from "node:assert/strict";
import { customersFromOrders } from "../lib/customers.js";

const order = (id, customerId, name, phone, status, total, createdAt) => ({
  id,
  customerId,
  status,
  total,
  createdAt,
  customer: { name, phone, city: "Karachi" },
});

test("guests are customers too, grouped by phone number", () => {
  const list = customersFromOrders([
    order(
      "AA-1",
      "u1",
      "Shazeb",
      "0333 3386641",
      "Delivered",
      2700,
      "2026-09-28T10:00:00Z",
    ),
    order(
      "AA-2",
      null,
      "Inayat",
      "03219207270",
      "Delivered",
      2700,
      "2026-09-29T12:00:00Z",
    ),
    order(
      "AA-3",
      null,
      "Inayat Ullah",
      "+92 321 9207270",
      "Pending",
      5150,
      "2026-09-29T13:00:00Z",
    ),
    // A guest order from a phone the account has used belongs to that account.
    order(
      "AA-4",
      null,
      "Shazeb",
      "03333386641",
      "Cancelled",
      2700,
      "2026-09-27T10:00:00Z",
    ),
  ]);
  assert.equal(list.length, 2);
  const [guest, member] = list;
  assert.equal(guest.guest, true);
  assert.equal(guest.name, "Inayat Ullah"); // from the latest order
  assert.equal(guest.orderCount, 2);
  assert.equal(guest.delivered, 1);
  assert.equal(guest.spent, 2700);
  assert.equal(member.guest, false);
  assert.equal(member.orderCount, 2);
  assert.equal(member.spent, 2700);
});
