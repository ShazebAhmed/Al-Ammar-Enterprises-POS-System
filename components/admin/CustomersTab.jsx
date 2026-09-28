"use client";
import Icon from "@/components/Icon";

export default function CustomersTab({ customers }) {
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
        Everyone who has placed at least one order while signed in. If someone
        forgets their password, they can reset it themselves from the sign-in
        screen — it emails them a link.
      </p>
      {customers.length === 0 ? (
        <div className="stx-card px-6 py-12 text-center">
          <Icon name="group" size={26} color="var(--ink-soft)" />
          <p style={{ color: "var(--ink-soft)", marginTop: 10 }}>
            No signed-in customers yet.
          </p>
        </div>
      ) : (
        <div className="stx-card" style={{ overflow: "hidden" }}>
          {customers.map((c, i) => (
            <div
              key={c.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "13px 16px",
                borderTop: i ? "1px solid var(--line)" : "none",
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: ".88rem" }}>
                  {c.name}
                </div>
                <div style={{ fontSize: ".78rem", color: "var(--ink-soft)" }}>
                  {c.phone}
                </div>
              </div>
              <span
                className="stx-mono"
                style={{ fontSize: ".8rem", color: "var(--ink-soft)" }}
              >
                {c.orderCount} order{c.orderCount === 1 ? "" : "s"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
