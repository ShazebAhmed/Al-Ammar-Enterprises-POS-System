"use client";
import { useState } from "react";
import Icon from "@/components/Icon";
import {
  formatMoney,
  formatOrderTime,
  itemName,
  ORDER_STATUSES,
  STATUS_COLOR,
  ordersCsv,
} from "@/lib/format";

const DAY_MS = 24 * 60 * 60 * 1000;
// Pending cash-on-delivery orders older than this are flagged so their stock can be released.
const STALE_ORDER_DAYS = 3;

// Saves the orders shown (after search and filter) as a spreadsheet file.
function downloadCsv(orders) {
  const blob = new Blob([ordersCsv(orders)], {
    type: "text/csv;charset=utf-8",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `AlAmmar-orders-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}
export default function OrdersTab({
  orders,
  settings,
  onUpdateStatus,
  onCancelStale,
  focusOrder = "",
}) {
  const [expanded, setExpanded] = useState(focusOrder.toUpperCase() || null);
  const pendingDays = (o) =>
    Math.floor((Date.now() - new Date(o.createdAt).getTime()) / DAY_MS);
  const stale = orders.filter(
    (o) => o.status === "Pending" && pendingDays(o) >= STALE_ORDER_DAYS,
  ).length;
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState(focusOrder);
  const visible = orders.filter(
    (o) =>
      (filter === "All" || o.status === filter) &&
      `${o.id} ${o.customer.name} ${o.customer.phone}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <div>
      <div
        className="stx-display"
        style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: 18 }}
      >
        Orders
      </div>
      {stale > 0 && (
        <div
          className="stx-card px-4 py-3"
          role="status"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 14,
          }}
        >
          <span style={{ flex: 1, fontSize: ".86rem" }}>
            {stale} pending {stale === 1 ? "order has" : "orders have"} waited
            {` ${STALE_ORDER_DAYS}`} days or more. Their stock is still
            reserved.
          </span>
          <button
            type="button"
            className="stx-btn px-3 py-1"
            style={{ fontSize: ".8rem" }}
            onClick={() => {
              if (
                window.confirm(
                  `Cancel ${stale} pending ${stale === 1 ? "order" : "orders"} older than ${STALE_ORDER_DAYS} days? Their stock will return to the shop.`,
                )
              )
                onCancelStale(STALE_ORDER_DAYS);
            }}
          >
            Cancel old pending orders
          </button>
        </div>
      )}
      <div className="admin-tools">
        <input
          className="stx-input"
          aria-label="Search orders"
          placeholder="Search order, name or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="stx-input"
          aria-label="Filter order status"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          {["All", ...ORDER_STATUSES].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <button
          type="button"
          className="stx-btn stx-btn-outline"
          disabled={!visible.length}
          onClick={() => downloadCsv(visible)}
        >
          <Icon name="download" size={16} /> Export CSV
        </button>
      </div>
      {visible.length === 0 ? (
        <div className="stx-card px-6 py-12 text-center">
          <Icon name="list_alt" size={28} color="var(--ink-soft)" />
          <p style={{ color: "var(--ink-soft)", marginTop: 10 }}>
            No orders yet.
          </p>
        </div>
      ) : (
        <div className="stx-card" style={{ overflow: "hidden" }}>
          {visible.map((o, i) => (
            <div
              key={o.id}
              style={{ borderTop: i ? "1px solid var(--line)" : "none" }}
            >
              <button
                onClick={() => setExpanded(expanded === o.id ? null : o.id)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "13px 16px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  flexWrap: "wrap",
                }}
              >
                <span
                  className="stx-mono"
                  style={{ fontSize: ".82rem", minWidth: 110 }}
                >
                  {o.id}
                </span>
                <span style={{ flex: 1, fontSize: ".85rem", fontWeight: 600 }}>
                  {o.customer.name}
                </span>
                <span style={{ fontSize: ".78rem", color: "var(--ink-soft)" }}>
                  {formatOrderTime(o.createdAt)}
                  {o.status === "Pending" && pendingDays(o) >= 1 && (
                    <span
                      style={{
                        marginLeft: 6,
                        color:
                          pendingDays(o) >= STALE_ORDER_DAYS
                            ? "var(--danger)"
                            : "inherit",
                      }}
                    >
                      · pending {pendingDays(o)}d
                    </span>
                  )}
                </span>
                <span
                  className="stx-mono"
                  style={{
                    fontSize: ".85rem",
                    minWidth: 80,
                    textAlign: "right",
                  }}
                >
                  {formatMoney(o.total, settings.currencySymbol)}
                </span>
                <span
                  style={{
                    fontSize: ".75rem",
                    fontWeight: 700,
                    color: STATUS_COLOR[o.status],
                    minWidth: 80,
                    textAlign: "right",
                  }}
                >
                  {o.status}
                </span>
              </button>
              {expanded === o.id && (
                <div
                  style={{
                    padding: "0 16px 16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: 24,
                      flexWrap: "wrap",
                      fontSize: ".85rem",
                    }}
                  >
                    <div>
                      <Icon
                        name="call"
                        size={13}
                        style={{ verticalAlign: "middle", marginRight: 4 }}
                      />
                      {o.customer.phone}
                    </div>
                    <div>
                      <Icon
                        name="location_on"
                        size={13}
                        style={{ verticalAlign: "middle", marginRight: 4 }}
                      />
                      {o.customer.address}, {o.customer.city}
                    </div>
                  </div>
                  {o.customer.notes && (
                    <div
                      style={{ fontSize: ".82rem", color: "var(--ink-soft)" }}
                    >
                      Note: {o.customer.notes}
                    </div>
                  )}
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 4 }}
                  >
                    {o.items.map((it) => (
                      <div
                        key={`${it.productId}:${it.variant || ""}`}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: ".82rem",
                        }}
                      >
                        <span>
                          {itemName(it.name, it.variant)} × {it.qty}
                        </span>
                        <span className="stx-mono">
                          {formatMoney(
                            it.price * it.qty,
                            settings.currencySymbol,
                          )}
                        </span>
                      </div>
                    ))}
                    {o.discount > 0 && (
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: ".82rem",
                          color: "var(--brick)",
                        }}
                      >
                        <span>Discount ({o.couponCode || "code"})</span>
                        <span className="stx-mono">
                          − {formatMoney(o.discount, settings.currencySymbol)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginTop: 4,
                    }}
                  >
                    <span className="stx-label">Status</span>
                    <select
                      aria-label={`Status for ${o.id}`}
                      value={o.status}
                      onChange={(e) => onUpdateStatus(o.id, e.target.value)}
                      className="stx-input"
                      style={{ width: "auto" }}
                    >
                      {[
                        o.status,
                        ...({
                          Pending: ["Confirmed", "Cancelled"],
                          Confirmed: ["Shipped", "Cancelled"],
                          Shipped: ["Delivered"],
                          Delivered: [],
                          Cancelled: [],
                        }[o.status] || []),
                      ].map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
