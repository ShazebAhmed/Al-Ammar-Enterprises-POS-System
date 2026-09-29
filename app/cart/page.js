"use client";
import Link from "next/link";
import { useStore } from "@/components/Providers";
import useCartProducts from "@/components/useCartProducts";
import Icon from "@/components/Icon";
import { formatMoney } from "@/lib/format";
import { cartTotals, lineStock } from "@/lib/cart";
import { whatsappOrderLink } from "@/lib/whatsapp";
export default function CartPage() {
  const { setCartQty, removeFromCart, syncError, retrySync } = useStore();
  const { lines, settings, loading, error, invalid, retry } = useCartProducts();
  const valid = lines.filter((l) => l.product);
  const totals = cartTotals(valid, settings.shippingFee);
  const money = (n) => formatMoney(n, settings.currencySymbol);
  const whatsappLink = invalid ? "" : whatsappOrderLink(settings, valid);
  return (
    <main className="page-wrap">
      <Link className="back-link" href="/">
        <Icon name="chevron_left" size={15} /> Continue exploring
      </Link>
      <div className="page-heading">
        <span className="eyebrow">YOUR EVERYDAY FINDS</span>
        <h1>
          Your basket<span className="gold-dot">.</span>
        </h1>
        <p>A few good things, ready to come home.</p>
      </div>
      {syncError && (
        <div className="inline-error" role="alert">
          {syncError}{" "}
          <button className="text-button" onClick={retrySync}>
            Retry sync
          </button>
        </div>
      )}
      {loading ? (
        <p role="status" className="muted">
          Checking prices and availability…
        </p>
      ) : error ? (
        <div className="empty-state" role="alert">
          <p>{error}</p>
          <button className="stx-btn stx-btn-outline" onClick={retry}>
            Try again
          </button>
        </div>
      ) : !lines.length ? (
        <div className="empty-state">
          <Icon name="shopping_cart" size={40} />
          <h2>Your next favourite is waiting.</h2>
          <p>Your basket is empty. Let’s find something you’ll love.</p>
          <Link className="stx-btn stx-btn-primary" href="/#collection">
            Shop the collection <Icon name="arrow_forward" />
          </Link>
        </div>
      ) : (
        <div className="checkout-grid">
          <section aria-labelledby="basket-items">
            <h2 id="basket-items" className="sr-only">
              Items in your basket
            </h2>
            {lines.map((l) => (
              <article
                key={`${l.productId}:${l.variant || ""}`}
                className="cart-item"
              >
                <div className="cart-thumb">
                  {l.product?.images?.[0] ? (
                    <img src={l.product.images[0]} alt={l.product.name} />
                  ) : (
                    <Icon name="inventory_2" size={22} />
                  )}
                </div>
                <div>
                  <small>{l.product?.category || "Unavailable product"}</small>
                  <h3>
                    {l.product ? (
                      <Link href={`/product/${l.productId}`}>
                        {l.product.name}
                      </Link>
                    ) : (
                      "This product is no longer available"
                    )}
                  </h3>
                  {l.product && (
                    <>
                      {l.variant && (
                        <small className="cart-option">
                          {l.product.optionLabel || "Option"}: {l.variant}
                        </small>
                      )}
                      <small>{money(l.product.price)} each</small>
                      <div
                        style={{ marginTop: 10 }}
                        className="quantity-control"
                      >
                        <button
                          aria-label={`Decrease ${l.product.name}`}
                          onClick={() =>
                            setCartQty(
                              l.productId,
                              l.qty - 1,
                              lineStock(l.product, l.variant),
                              l.variant,
                            )
                          }
                        >
                          <Icon name="remove" size={14} />
                        </button>
                        <output>{l.qty}</output>
                        <button
                          aria-label={`Increase ${l.product.name}`}
                          disabled={l.qty >= lineStock(l.product, l.variant)}
                          onClick={() =>
                            setCartQty(
                              l.productId,
                              l.qty + 1,
                              lineStock(l.product, l.variant),
                              l.variant,
                            )
                          }
                        >
                          <Icon name="add" size={14} />
                        </button>
                      </div>
                    </>
                  )}
                  {(!l.product || l.qty > lineStock(l.product, l.variant)) && (
                    <p className="cart-stock-warning">
                      {!l.product
                        ? "Remove this item to continue."
                        : l.product.variants?.length && !l.variant
                          ? `Remove this item and choose a ${(l.product.optionLabel || "option").toLowerCase()} on the product page.`
                          : `Only ${lineStock(l.product, l.variant)} available. Update the quantity.`}
                    </p>
                  )}
                </div>
                <div className="cart-item-price">
                  <strong>
                    {l.product ? money(l.qty * l.product.price) : "—"}
                  </strong>
                  <button
                    className="remove-button"
                    aria-label={`Remove ${l.product?.name || "unavailable product"}`}
                    onClick={() => removeFromCart(l.productId, l.variant)}
                  >
                    <Icon name="delete" size={13} /> Remove
                  </button>
                </div>
              </article>
            ))}
          </section>
          <aside className="stx-card order-summary">
            <h2>A little summary</h2>
            <div className="summary-row">
              <span>Subtotal</span>
              <span>{money(totals.subtotal)}</span>
            </div>
            <div className="summary-row">
              <span>Delivery</span>
              <span>{money(totals.shipping)}</span>
            </div>
            <div className="summary-row total">
              <span>Total</span>
              <span>{money(totals.total)}</span>
            </div>
            {invalid ? (
              <div className="inline-error">
                Please update unavailable items before checkout.
              </div>
            ) : (
              <Link className="stx-btn stx-btn-primary" href="/checkout">
                Continue to checkout <Icon name="arrow_forward" />
              </Link>
            )}
            {whatsappLink && (
              <a
                className="stx-btn stx-btn-outline"
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                style={{ marginTop: 8 }}
              >
                <Icon name="chat" /> Order on WhatsApp
              </a>
            )}
            <p className="summary-note">
              Cash on delivery · No payment required now
            </p>
          </aside>
        </div>
      )}
    </main>
  );
}
