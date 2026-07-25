"use client";
import { useState } from "react";
import { useStore } from "./Providers";
import Icon from "./Icon";

export default function AddToCartButton({ productId, qty = 1, style = {}, children }) {
  const { addToCart } = useStore();
  const [added, setAdded] = useState(false);

  function handleClick() {
    addToCart(productId, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  return (
    <button onClick={handleClick} className="stx-btn stx-btn-outline" style={{ padding: "7px 0", fontSize: ".82rem", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, ...style }}>
      <Icon name={added ? "check" : "add"} size={15} />
      {children || (added ? "Added" : "Add to cart")}
    </button>
  );
}
