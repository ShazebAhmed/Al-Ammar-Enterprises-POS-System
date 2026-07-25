import Icon from "./Icon";

export default function Footer({ settings }) {
  return (
    <footer style={{ borderTop: "1px solid var(--line)", marginTop: 48, background: "var(--cream)" }}>
      <div style={{ maxWidth: 1120, margin: "0 auto" }} className="px-4 py-6 grid gap-6">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 24 }}>
          <div>
            <div className="stx-display" style={{ fontWeight: 700, fontSize: "1.05rem", marginBottom: 6 }}>{settings.storeName || "Your Store"}</div>
            <p style={{ fontSize: ".85rem", color: "var(--ink-soft)", lineHeight: 1.5 }}>{settings.aboutText || "Everything you need, in one general store."}</p>
          </div>
          <div>
            <div className="stx-label" style={{ marginBottom: 8 }}>Contact</div>
            {settings.contactPhone && <div style={{ fontSize: ".85rem", display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}><Icon name="call" size={14} />{settings.contactPhone}</div>}
            {settings.whatsapp && <div style={{ fontSize: ".85rem", color: "var(--ink-soft)" }}>WhatsApp: {settings.whatsapp}</div>}
          </div>
          <div>
            <div className="stx-label" style={{ marginBottom: 8 }}>How you pay</div>
            <p style={{ fontSize: ".85rem", color: "var(--ink-soft)", lineHeight: 1.5 }}>Cash on delivery, or we'll call to confirm your phone order. Online card payment is coming soon.</p>
          </div>
        </div>
        <div style={{ borderTop: "1px solid var(--line)", paddingTop: 14, fontSize: ".75rem", color: "var(--ink-soft)" }}>© {new Date().getFullYear()} {settings.storeName || "Your Store"}</div>
      </div>
    </footer>
  );
}
