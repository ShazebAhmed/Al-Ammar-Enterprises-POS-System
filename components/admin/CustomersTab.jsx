"use client";
import Icon from "@/components/Icon";
import { formatMoney, formatOrderTime } from "@/lib/format";

export default function CustomersTab({ customers, settings }) {
  const guests = customers.filter((c) => c.guest).length;
  return (
    <div>
      <div
        className="stx-display"
        style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: 6 }}
      >
        Customers
      </div>
      <p
        style={{
          fontSize: ".82rem",
          color: "var(--ink-soft)",
          marginBottom: 18,
        }}
      >
        Everyone who has ordered: {customers.length - guests} with an account
        and {guests} {guests === 1 ? "guest" : "guests"} (ordered without an
        account, grouped by phone number). Spent counts delivered orders.
      </p>
      {customers.length === 0 ? (
        <div className="stx-card px-6 py-12 text-center">
          <Icon name="group" size={26} color="var(--ink-soft)" />
          <p style={{ color: "var(--ink-soft)", marginTop: 10 }}>
            No customers yet.
          </p>
        </div>
      ) : (
        <div className="stx-card" style={{ overflow: "hidden" }}>
          {customers.map((c, i) => (
            <div
              key={c.id}
              className="customer-row"
              style={{ borderTop: i ? "1px solid var(--line)" : "none" }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: ".88rem" }}>
                  {c.name}{" "}
                  <span className={`customer-badge ${c.guest ? "guest" : ""}`}>
                    {c.guest ? "Guest" : "Account"}
                  </span>
                </div>
                <div style={{ fontSize: ".78rem", color: "var(--ink-soft)" }}>
                  {c.phone}
                  {c.city ? ` · ${c.city}` : ""} · last order{" "}
                  {formatOrderTime(c.lastOrder)}
                </div>
              </div>
              <div style={{ textAlign: "right", fontSize: ".8rem" }}>
                <div style={{ fontWeight: 600 }}>
                  {formatMoney(c.spent, settings.currencySymbol)}
                </div>
                <div style={{ color: "var(--ink-soft)" }}>
                  {c.orderCount} order{c.orderCount === 1 ? "" : "s"} ·{" "}
                  {c.delivered} delivered
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
