"use client";
import { useMemo, useRef, useState } from "react";
import { useStore } from "./Providers";
import Icon from "./Icon";
import { descriptionSummary, formatMoney, salePercent } from "@/lib/format";
import { whatsappOrderLink, whatsappRestockLink } from "@/lib/whatsapp";
import { lineStock, sameLine } from "@/lib/cart";
import BuyNowButton from "./BuyNowButton";
import { SHOW_PHOTO_EVENT } from "./ImageGallery";
import { optionPicker } from "@/lib/productOptions";
import { photo, PHOTO_SIZES } from "@/lib/photo";
export default function ProductPurchasePanel({ product, settings }) {
  const { cart, addToCart, cartReady } = useStore();
  const [qty, setQty] = useState(1);
  // Products with colours and/or sizes need them chosen before adding.
  const options = product.variants || [];
  const picker = useMemo(() => optionPicker(product), [product]);
  const { colors, sizes, sizeLabel } = picker;
  const only = (list) =>
    list.length === 1 && list[0].stock > 0 ? list[0].name : "";
  const [color, setColor] = useState(() => only(colors));
  const [size, setSize] = useState(() => only(sizes));
  const chosen =
    (!colors.length || color) && (!sizes.length || size)
      ? picker.find(color, size)
      : null;
  const choice = chosen?.name || "";
  const missing = [
    colors.length && !color && "colour",
    sizes.length && !size && sizeLabel.toLowerCase(),
  ].filter(Boolean);
  // A size's stock in the chosen colour, or in all colours before one is chosen.
  const sizeStock = (name) =>
    colors.length && color ? picker.find(color, name)?.stock || 0 : 0;
  function chooseColor(c) {
    setColor(c.name);
    setQty(1);
    if (size && sizes.length && !(picker.find(c.name, size)?.stock > 0))
      setSize("");
    window.dispatchEvent(
      new CustomEvent(SHOW_PHOTO_EVENT, {
        detail: { images: c.images, label: c.name },
      }),
    );
  }
  const totalStock = Number(product.stock) || 0;
  const stock = options.length ? lineStock(product, choice) : totalStock;
  const inBasket =
    cart.find((l) => sameLine(l, String(product.id), choice))?.qty || 0;
  const available = Math.max(0, stock - inBasket);
  const needsChoice = options.length > 0 && !choice;
  const missingText = missing.join(" and ");
  // Tapping Add to basket / Buy now before choosing an option points at the options.
  const [nudge, setNudge] = useState(0);
  const pickerRef = useRef(null);
  function askForChoice() {
    setNudge((n) => n + 1);
    pickerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
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
        <div
          ref={pickerRef}
          // A new key restarts the attention animation on every tap.
          key={needsChoice && nudge ? `nudge-${nudge}` : "picker"}
          className={`option-pickers${needsChoice && nudge ? " nudge" : ""}`}
        >
          {colors.length > 0 && (
            <fieldset className="option-picker">
              <legend className="stx-label">
                Colour{color ? `: ${color}` : ""}
              </legend>
              <div>
                {colors.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    className={`${c.images.length ? "swatch-option" : ""}${c.name === color ? " active" : ""}`}
                    aria-pressed={c.name === color}
                    disabled={c.stock <= 0}
                    title={c.stock <= 0 ? `${c.name}: sold out` : undefined}
                    onClick={() => chooseColor(c)}
                  >
                    {c.images[0] && (
                      <img {...photo(c.images[0], PHOTO_SIZES.thumb)} alt="" />
                    )}
                    {c.name}
                  </button>
                ))}
              </div>
            </fieldset>
          )}
          {sizes.length > 0 && (
            <fieldset className="option-picker">
              <legend className="stx-label">
                {sizeLabel}
                {size ? `: ${size}` : ""}
              </legend>
              <div>
                {sizes.map((s) => {
                  const left =
                    colors.length && color ? sizeStock(s.name) : s.stock;
                  return (
                    <button
                      key={s.name}
                      type="button"
                      className={s.name === size ? "active" : ""}
                      aria-pressed={s.name === size}
                      disabled={left <= 0}
                      title={left <= 0 ? `${s.name}: sold out` : undefined}
                      onClick={() => {
                        setSize(s.name);
                        setQty(1);
                      }}
                    >
                      {s.name}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}
          {needsChoice && nudge > 0 && (
            <p className="option-nudge" role="alert">
              Please choose a {missingText} first.
            </p>
          )}
        </div>
      )}
      <div className={`availability ${totalStock ? "" : "sold-out"}`}>
        <span />
        {!totalStock
          ? "Currently out of stock"
          : needsChoice
            ? `Choose a ${missingText}`
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
