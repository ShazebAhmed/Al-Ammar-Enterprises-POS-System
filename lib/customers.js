import { whatsappPhone } from "./whatsapp.js";

// Everyone who has ordered, for the admin's Customers tab. Signed-in customers are
// grouped by their account; guests (who ordered without an account) by phone
// number. A guest order from a phone an account has used goes to that account.
// orders: as from orderFromRow, newest first or in any order.
export function customersFromOrders(orders) {
  const phoneKey = (phone) =>
    whatsappPhone(phone) || String(phone || "").trim();
  const accountByPhone = new Map();
  for (const o of orders)
    if (o.customerId)
      accountByPhone.set(phoneKey(o.customer.phone), o.customerId);

  const people = new Map();
  for (const o of orders) {
    const account =
      o.customerId || accountByPhone.get(phoneKey(o.customer.phone));
    const key = account
      ? `account:${account}`
      : `phone:${phoneKey(o.customer.phone)}`;
    const c = people.get(key) || {
      id: key,
      guest: !account,
      name: "",
      phone: "",
      city: "",
      orderCount: 0,
      delivered: 0,
      spent: 0,
      lastOrder: "",
    };
    c.orderCount++;
    if (o.status === "Delivered") {
      c.delivered++;
      c.spent = Math.round((c.spent + Number(o.total || 0)) * 100) / 100;
    }
    // Name, phone and city from their latest order.
    if (!c.lastOrder || o.createdAt > c.lastOrder) {
      c.lastOrder = o.createdAt;
      c.name = o.customer.name;
      c.phone = o.customer.phone;
      c.city = o.customer.city;
    }
    people.set(key, c);
  }
  return [...people.values()].sort((a, b) =>
    b.lastOrder.localeCompare(a.lastOrder),
  );
}
