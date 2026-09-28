"use client";
import { useState } from "react";
import { useStore } from "./Providers";
import Icon from "./Icon";
import { formatMoney, salePercent } from "@/lib/format";
import { whatsappOrderLink } from "@/lib/whatsapp";
export default function ProductPurchasePanel({ product, settings }) {
  const { cart, addToCart, cartReady } = useStore();
  const [qty, setQty] = useState(1);
  const stock = Number(product.stock) || 0;
  const inBasket =
    cart.find((l) => l.productId === String(product.id))?.qty || 0;
  const available = Math.max(0, stock - inBasket);
  const whatsappLink = stock
    ? whatsappOrderLink(settings, [
        { product, qty: Math.max(1, Math.min(qty, stock)) },
      ])
    : "";
  return (
    <div className="purchase-panel">
      <span className="eyebrow">{product.category || "THE COLLECTION"}</span>
      <h1>{product.name}</h1>
      <div className="purchase-price">
        {formatMoney(product.price, settings.currencySymbol)}
        {salePercent(product) > 0 && (
          <>
            <s className="was-price">
              {formatMoney(product.compareAtPrice, settings.currencySymbol)}
            </s>
            <span className="sale-note">
              Save{" "}
              {formatMoney(
                product.compareAtPrice - product.price,
                settings.currencySymbol,
              )}{" "}
              ({salePercent(product)}% off)
            </span>
          </>
        )}
      </div>
      <div className={`availability ${stock ? "" : "sold-out"}`}>
        <span />
        {stock
          ? `${stock} available${inBasket ? ` · ${inBasket} in your basket` : ""}`
          : "Currently out of stock"}
      </div>
      <p className="purchase-description">
        {product.description?.slice(0, 200) ||
          "An everyday find from our collection."}
      </p>
      {stock > 0 && (
        <>
          <label className="stx-label">Quantity</label>
          <div className="purchase-actions">
            <div className="quantity-control">
              <button
                aria-label="Decrease quantity"
                disabled={qty <= 1}
                onClick={() => setQty((q) => Math.max(1, q - 1))}
              >
                <Icon name="remove" size={16} />
              </button>
              <output>{Math.min(qty, available) || 1}</output>
              <button
                aria-label="Increase quantity"
                disabled={qty >= available}
                onClick={() => setQty((q) => Math.min(available, q + 1))}
              >
                <Icon name="add" size={16} />
              </button>
            </div>
            <button
              className="stx-btn stx-btn-primary"
              disabled={!cartReady || !available}
              onClick={() =>
                addToCart(product.id, Math.min(qty, available), stock)
              }
            >
              <Icon name="shopping_cart" />
              {available ? "Add to basket" : "All available stock added"}
            </button>
          </div>
          {whatsappLink && (
            <a
              className="stx-btn stx-btn-outline"
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              style={{ marginTop: 10 }}
            >
              <Icon name="chat" /> Order on WhatsApp
            </a>
          )}
        </>
      )}
      <div className="purchase-benefits">
        <p>
          <Icon name="local_shipping" /> Delivery:{" "}
          {formatMoney(settings.shippingFee, settings.currencySymbol)}
        </p>
        <p>
          <Icon name="account_balance_wallet" /> Cash on delivery
        </p>
        <p>
          <Icon name="call" /> We’ll call to confirm your order
        </p>
      </div>
    </div>
  );
}
