"use client";
import { useRef, useState } from "react";
import { useStore } from "./Providers";
import Icon from "./Icon";
import { descriptionSummary, formatMoney, salePercent } from "@/lib/format";
import { whatsappOrderLink, whatsappRestockLink } from "@/lib/whatsapp";
import { lineStock, sameLine } from "@/lib/cart";
import BuyNowButton from "./BuyNowButton";
import { SHOW_PHOTO_EVENT } from "./ImageGallery";
export default function ProductPurchasePanel({ product, settings }) {
  const { cart, addToCart, cartReady } = useStore();
  const [qty, setQty] = useState(1);
  // Products with options (size, colour) need one chosen before adding.
  const options = product.variants || [];
  const label = product.optionLabel || "Option";
  const [choice, setChoice] = useState(
    options.length === 1 && options[0].stock > 0 ? options[0].name : "",
  );
  const totalStock = Number(product.stock) || 0;
  const stock = options.length ? lineStock(product, choice) : totalStock;
  const inBasket =
    cart.find((l) => sameLine(l, String(product.id), choice))?.qty || 0;
  const available = Math.max(0, stock - inBasket);
  const needsChoice = options.length > 0 && !choice;
  // Tapping Add to basket / Buy now before choosing an option points at the options.
  const [nudge, setNudge] = useState(0);
  const picker = useRef(null);
  function askForChoice() {
    setNudge((n) => n + 1);
    picker.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  const whatsappLink =
    stock && !needsChoice
      ? whatsappOrderLink(settings, [
          {
            product,
            variant: choice,
            qty: Math.max(1, Math.min(qty, stock)),
          },
        ])
      : "";
  const restockLink = totalStock ? "" : whatsappRestockLink(settings, product);
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
      {options.length > 0 && (
        <fieldset
          ref={picker}
          // A new key restarts the attention animation on every tap.
          key={needsChoice && nudge ? `nudge-${nudge}` : "picker"}
          className={`option-picker${needsChoice && nudge ? " nudge" : ""}`}
        >
          <legend className="stx-label">
            {label}
            {choice ? `: ${choice}` : ""}
          </legend>
          <div>
            {options.map((o) => (
              <button
                key={o.name}
                type="button"
                className={o.name === choice ? "active" : ""}
                aria-pressed={o.name === choice}
                disabled={o.stock <= 0}
                onClick={() => {
                  setChoice(o.name);
                  setQty(1);
                  if (o.image)
                    window.dispatchEvent(
                      new CustomEvent(SHOW_PHOTO_EVENT, { detail: o.image }),
                    );
                }}
              >
                {o.name}
              </button>
            ))}
          </div>
          {needsChoice && nudge > 0 && (
            <p className="option-nudge" role="alert">
              Please choose a {label.toLowerCase()} first.
            </p>
          )}
        </fieldset>
      )}
      <div className={`availability ${totalStock ? "" : "sold-out"}`}>
        <span />
        {!totalStock
          ? "Currently out of stock"
          : needsChoice
            ? `Choose a ${label.toLowerCase()}`
            : `${stock} available${inBasket ? ` · ${inBasket} in your basket` : ""}`}
      </div>
      <p className="purchase-description">
        {descriptionSummary(product.description, 200) ||
          "An everyday find from our collection."}
      </p>
      {restockLink && (
        <a
          className="stx-btn stx-btn-outline"
          href={restockLink}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Icon name="chat" /> Ask on WhatsApp when it&apos;s back
        </a>
      )}
      {totalStock > 0 && (
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
              disabled={!cartReady || (!needsChoice && !available)}
              onClick={() =>
                needsChoice
                  ? askForChoice()
                  : addToCart(
                      product.id,
                      Math.min(qty, available),
                      stock,
                      choice,
                    )
              }
            >
              <Icon name="shopping_cart" />
              {needsChoice || available
                ? "Add to basket"
                : "All available stock added"}
            </button>
          </div>
          <BuyNowButton
            className="stx-btn stx-btn-gold buy-now-wide"
            productId={product.id}
            variant={choice}
            qty={Math.max(1, Math.min(qty, stock))}
            disabled={!needsChoice && !stock}
            beforeBuy={() => {
              if (!needsChoice) return true;
              askForChoice();
              return false;
            }}
          >
            Buy now
          </BuyNowButton>
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
          {settings.freeDeliveryOver > 0 &&
            ` (free over ${formatMoney(settings.freeDeliveryOver, settings.currencySymbol)})`}
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
