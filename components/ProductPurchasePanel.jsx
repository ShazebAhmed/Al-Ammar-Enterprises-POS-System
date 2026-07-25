"use client";
import { useState } from "react";
import { useStore } from "./Providers";
import Icon from "./Icon";
import { formatMoney } from "@/lib/format";

export default function ProductPurchasePanel({ product, settings }) {
  const { addToCart } = useStore();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const inStock = Number(product.stock) > 0;

  function handleAdd() {
    addToCart(product.id, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  return (
    <div className="stx-card px-5 py-5" style={{ position: "sticky", top: 90 }}>
      {product.category && <span className="stall-tag" style={{ pointerEvents: "none", marginBottom: 10, display: "inline-block" }}>{product.category}</span>}
      <div className="stx-display" style={{ fontSize: "1.3rem", fontWeight: 700, marginTop: 8 }}>{product.name}</div>
      <div className="stx-mono" style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--primary)", marginTop: 8 }}>{formatMoney(product.price, settings.currencySymbol)}</div>
      <div style={{ fontSize: ".82rem", color: inStock ? "var(--primary)" : "var(--danger)", marginTop: 4 }}>
        {inStock ? `${product.stock} in stock` : "Out of stock"}
      </div>

      {inStock && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 18 }}>
            <span className="stx-label">Qty</span>
            <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="stx-btn stx-btn-outline" style={{ width: 30, height: 30, padding: 0 }}><Icon name="remove" size={15} /></button>
            <span className="stx-mono" style={{ minWidth: 20, textAlign: "center" }}>{qty}</span>
            <button onClick={() => setQty((q) => Math.min(Number(product.stock), q + 1))} className="stx-btn stx-btn-outline" style={{ width: 30, height: 30, padding: 0 }}><Icon name="add" size={15} /></button>
          </div>
          <button onClick={handleAdd} className="stx-btn stx-btn-primary" style={{ width: "100%", padding: "11px 0", marginTop: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <Icon name={added ? "check" : "shopping_cart"} size={17} color="#fff" /> {added ? "Added to cart" : "Add to cart"}
          </button>
        </>
      )}
    </div>
  );
}
