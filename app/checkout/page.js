"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useStore } from "@/components/Providers";
import Icon from "@/components/Icon";
import { formatMoney, settingsFromRow, DEFAULT_SETTINGS, productFromRow, uid } from "@/lib/format";

export default function CheckoutPage() {
  const { supabase, currentUser, profile, cart, clearCart } = useStore();
  const [products, setProducts] = useState([]);
  const [settings, setSettings] = useState(null);
  const [order, setOrder] = useState(null); // set once placed -> shows confirmation

  useEffect(() => {
    (async () => {
      const [{ data: p }, { data: s }] = await Promise.all([
        supabase.from("products").select("*"),
        supabase.from("store_settings").select("*").eq("id", 1).single(),
      ]);
      setProducts((p || []).map(productFromRow));
      setSettings(s ? settingsFromRow(s) : DEFAULT_SETTINGS);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!settings) {
    return <main style={{ maxWidth: 900, margin: "0 auto" }} className="px-4 py-6"><p style={{ color: "var(--ink-soft)" }}>Loading…</p></main>;
  }

  if (order) {
    return <ConfirmationView order={order} settings={settings} />;
  }

  const lines = cart
    .map((line) => ({ ...line, product: products.find((p) => p.id === line.productId) }))
    .filter((l) => l.product);
  const subtotal = lines.reduce((sum, l) => sum + (Number(l.product.price) || 0) * l.qty, 0);

  async function placeOrder(customerDetails) {
    const newOrder = {
      id: uid("ORD-").toUpperCase(),
      customerId: currentUser?.id || null,
      items: lines.map((l) => ({ productId: l.product.id, name: l.product.name, price: Number(l.product.price) || 0, qty: l.qty })),
      subtotal,
      shippingFee: Number(settings.shippingFee) || 0,
      total: subtotal + (Number(settings.shippingFee) || 0),
      customer: customerDetails,
      status: "Pending",
    };
    const { error } = await supabase.from("orders").insert({
      id: newOrder.id, customer_id: newOrder.customerId, items: newOrder.items,
      subtotal: newOrder.subtotal, shipping_fee: newOrder.shippingFee, total: newOrder.total,
      customer_name: customerDetails.name, customer_phone: customerDetails.phone,
      customer_address: customerDetails.address, customer_city: customerDetails.city, customer_notes: customerDetails.notes,
      status: "Pending",
    });
    if (error) {
      alert("Couldn't place the order. Please try again.");
      console.error(error);
      return;
    }
    clearCart();
    setOrder({ ...newOrder, createdAt: new Date().toISOString() });
  }

  return <CheckoutForm lines={lines} settings={settings} subtotal={subtotal} profile={profile} onPlaceOrder={placeOrder} />;
}

function CheckoutForm({ lines, settings, subtotal, profile, onPlaceOrder }) {
  const [form, setForm] = useState({ name: profile?.name || "", phone: profile?.phone || "", address: "", city: "", notes: "" });
  const [submitting, setSubmitting] = useState(false);
  const shipping = Number(settings.shippingFee) || 0;
  const canSubmit = form.name.trim() && form.phone.trim() && form.address.trim() && form.city.trim() && lines.length > 0;

  async function submit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    await onPlaceOrder(form);
    setSubmitting(false);
  }

  return (
    <main style={{ maxWidth: 900, margin: "0 auto" }} className="px-4 py-6">
      <Link href="/cart" style={{ color: "var(--ink-soft)", display: "flex", alignItems: "center", gap: 4, marginBottom: 16, width: "fit-content" }}><Icon name="chevron_left" size={18} /> Back to basket</Link>
      <div className="stx-display" style={{ fontSize: "1.6rem", fontWeight: 700, marginBottom: 8 }}>Checkout</div>
      {profile ? (
        <p style={{ color: "var(--ink-soft)", fontSize: ".85rem", marginBottom: 16 }}>This order will be saved to your account, {profile.name?.split(" ")[0] || "there"}.</p>
      ) : (
        <p style={{ color: "var(--ink-soft)", fontSize: ".85rem", marginBottom: 16 }}>Checking out as a guest — this order won't appear in an order history unless you sign in first.</p>
      )}

      {lines.length === 0 ? (
        <div className="stx-card px-6 py-12 text-center">
          <p style={{ color: "var(--ink-soft)" }}>Your basket is empty.</p>
          <Link href="/" className="stx-btn stx-btn-primary px-5 py-2.5 mt-4" style={{ display: "inline-block" }}>Browse products</Link>
        </div>
      ) : (
        <div className="checkout-grid">
          <form onSubmit={submit} className="stx-card px-5 py-5" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="stx-label" style={{ display: "flex", alignItems: "center", gap: 5 }}><Icon name="person" size={14} /> Delivery details</div>
            <div><label className="stx-label">Full name</label><input className="stx-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required style={{ marginTop: 4 }} /></div>
            <div><label className="stx-label">Phone number</label><input className="stx-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required placeholder="03xx-xxxxxxx" style={{ marginTop: 4 }} /></div>
            <div><label className="stx-label">Address</label><input className="stx-input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} required style={{ marginTop: 4 }} /></div>
            <div><label className="stx-label">City</label><input className="stx-input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} required style={{ marginTop: 4 }} /></div>
            <div><label className="stx-label">Notes (optional)</label><textarea className="stx-input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} style={{ marginTop: 4 }} /></div>

            <div style={{ marginTop: 8 }}>
              <div className="stx-label" style={{ marginBottom: 8 }}>Payment method</div>
              <div className="stx-card px-4 py-3" style={{ borderColor: "var(--primary)", display: "flex", alignItems: "center", gap: 10 }}>
                <input type="radio" checked readOnly />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: ".88rem" }}>Cash on delivery / Phone confirmation</div>
                  <div style={{ fontSize: ".78rem", color: "var(--ink-soft)" }}>We'll call {form.phone || "you"} to confirm before dispatch.</div>
                </div>
              </div>
              <div className="stx-card px-4 py-3 mt-2" style={{ opacity: 0.6, display: "flex", alignItems: "center", gap: 10 }}>
                <input type="radio" disabled />
                <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: ".88rem" }}>Online payment (card / JazzCash / EasyPaisa)</div></div>
                <span className="badge-soon">Coming soon</span>
              </div>
            </div>

            <button type="submit" disabled={!canSubmit || submitting} className="stx-btn stx-btn-primary" style={{ padding: "12px 0", marginTop: 8 }}>{submitting ? "Placing order…" : "Place order"}</button>
          </form>

          <aside className="stx-card px-5 py-5" style={{ height: "fit-content" }}>
            <div className="stx-label" style={{ marginBottom: 10 }}>Order summary</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
              {lines.map((l) => (
                <div key={l.productId} style={{ display: "flex", justifyContent: "space-between", fontSize: ".85rem" }}><span>{l.product.name} × {l.qty}</span><span className="stx-mono">{formatMoney(l.product.price * l.qty, settings.currencySymbol)}</span></div>
              ))}
            </div>
            <div style={{ borderTop: "1px solid var(--line)", paddingTop: 10, display: "flex", justifyContent: "space-between", fontSize: ".9rem" }}><span style={{ color: "var(--ink-soft)" }}>Subtotal</span><span className="stx-mono">{formatMoney(subtotal, settings.currencySymbol)}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".9rem", marginTop: 4 }}><span style={{ color: "var(--ink-soft)" }}>Shipping</span><span className="stx-mono">{formatMoney(shipping, settings.currencySymbol)}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: "1.05rem", marginTop: 8, borderTop: "1px solid var(--line)", paddingTop: 8 }}><span>Total</span><span className="stx-mono">{formatMoney(subtotal + shipping, settings.currencySymbol)}</span></div>
          </aside>
        </div>
      )}
    </main>
  );
}

function ConfirmationView({ order, settings }) {
  return (
    <main style={{ maxWidth: 560, margin: "0 auto" }} className="px-4 py-14 text-center">
      <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--primary)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
        <Icon name="check" size={30} color="#fff" />
      </div>
      <div className="stx-display" style={{ fontSize: "1.5rem", fontWeight: 700 }}>Order received</div>
      <p style={{ color: "var(--ink-soft)", marginTop: 6 }}>Thanks, {order.customer.name}. We'll call {order.customer.phone} shortly to confirm before we dispatch.</p>

      <div className="ticket px-6 py-5 mt-8 text-left">
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}><span className="stx-label">Order</span><span className="stx-mono" style={{ fontWeight: 700 }}>{order.id}</span></div>
        {order.items.map((it) => (
          <div key={it.productId} style={{ display: "flex", justifyContent: "space-between", fontSize: ".85rem", marginBottom: 4 }}><span>{it.name} × {it.qty}</span><span className="stx-mono">{formatMoney(it.price * it.qty, settings.currencySymbol)}</span></div>
        ))}
        <div style={{ borderTop: "1px dashed var(--line)", marginTop: 8, paddingTop: 8, display: "flex", justifyContent: "space-between", fontWeight: 700 }}><span>Total due on delivery</span><span className="stx-mono">{formatMoney(order.total, settings.currencySymbol)}</span></div>
      </div>

      <Link href="/" className="stx-btn stx-btn-primary px-6 py-3 mt-10" style={{ display: "inline-block" }}>Continue shopping</Link>
    </main>
  );
}
