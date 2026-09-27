"use client";
import { useStore } from "./Providers";
import Icon from "./Icon";
export default function AddToCartButton({
  productId,
  qty = 1,
  stock = 999,
  style = {},
  children,
}) {
  const { addToCart, cartReady } = useStore();
  return (
    <button
      disabled={!cartReady}
      onClick={() => addToCart(productId, qty, stock)}
      className="add-button"
      style={style}
      aria-label="Add to basket"
    >
      <Icon name="add" size={16} />
      {children || "Add"}
    </button>
  );
}
