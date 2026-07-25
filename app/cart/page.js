"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useStore } from "@/components/Providers";
import Icon from "@/components/Icon";
import { formatMoney, settingsFromRow, DEFAULT_SETTINGS, productFromRow } from "@/lib/format";

export default function CartPage() {
  const { supabase, cart, setCartQty, removeFromCart } = useStore();
  const [products, setProducts] = useState([]);
  const [settings, setSettings] = useState(null);

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
    return <main style={{ maxWidth: 820, margin: "0 auto" }} className="px-4 py-6"><p style={{ color: "var(--ink-soft)" }}>Loading…</p></main>;
  }

  const lines = cart
    .map((line) => ({ ...line, product: products.find((p) => p.id === line.productId) }))
    .filter((l) => l.product);
  const subtotal = lines.reduce((sum, l) => sum + (Number(l.product.price) || 0) * l.qty, 0);
  const shipping = lines.length ? Number(settings.shippingFee) || 0 : 0;

  return (
    <main style={{ maxWidth: 820, margin: "0 auto" }} className="px-4 py-6">
      <div className="stx-display" style={{ fontSize: "1.6rem", fontWeight: 700, marginBottom: 18 }}>Your basket</div>

      {lines.length === 0 ? (
        <div className="stx-card px-6 py-14 text-center">
          <Icon name="shopping_cart" size={30} color="var(--ink-soft)" />
          <div style={{ fontWeight: 700, marginTop: 10 }}>Your basket is empty</div>
          <p style={{ color: "var(--ink-soft)", marginTop: 4, marginBottom: 14 }}>Add a few things and they'll show up here.</p>
          <Link href="/" className="stx-btn stx-btn-primary px-5 py-2.5" style={{ display: "inline-block" }}>Browse products</Link>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 22 }}>
            {lines.map((l) => (
              <div key={l.productId} className="stx-card px-4 py-3" style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ width: 60, height: 60, borderRadius: 8, overflow: "hidden", background: "#EFEBDD", flexShrink: 0 }}>
                  {l.product.images?.[0] && <img src={l.product.images[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: ".9rem" }}>{l.product.name}</div>
                  <div className="stx-mono" style={{ fontSize: ".85rem", color: "var(--ink-soft)" }}>{formatMoney(l.product.price, settings.currencySymbol)} each</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button onClick={() => setCartQty(l.productId, l.qty - 1)} className="stx-btn stx-btn-outline" style={{ width: 26, height: 26, padding: 0 }}><Icon name="remove" size={13} /></button>
                  <span className="stx-mono" style={{ minWidth: 16, textAlign: "center", fontSize: ".85rem" }}>{l.qty}</span>
                  <button onClick={() => setCartQty(l.productId, l.qty + 1)} className="stx-btn stx-btn-outline" style={{ width: 26, height: 26, padding: 0 }}><Icon name="add" size={13} /></button>
                </div>
                <div className="stx-mono" style={{ fontWeight: 700, minWidth: 80, textAlign: "right" }}>{formatMoney(l.product.price * l.qty, settings.currencySymbol)}</div>
                <button onClick={() => removeFromCart(l.productId)} style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer" }}><Icon name="delete" size={17} /></button>
              </div>
            ))}
          </div>
          <div className="stx-card px-5 py-5">
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".9rem", marginBottom: 6 }}><span style={{ color: "var(--ink-soft)" }}>Subtotal</span><span className="stx-mono">{formatMoney(subtotal, settings.currencySymbol)}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".9rem", marginBottom: 10 }}><span style={{ color: "var(--ink-soft)" }}>Shipping</span><span className="stx-mono">{formatMoney(shipping, settings.currencySymbol)}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: "1.1rem", borderTop: "1px solid var(--line)", paddingTop: 10 }}><span>Total</span><span className="stx-mono">{formatMoney(subtotal + shipping, settings.currencySymbol)}</span></div>
            <Link href="/checkout" className="stx-btn stx-btn-primary" style={{ width: "100%", padding: "12px 0", marginTop: 16, display: "block", textAlign: "center" }}>Proceed to checkout</Link>
          </div>
        </>
      )}
    </main>
  );
}
