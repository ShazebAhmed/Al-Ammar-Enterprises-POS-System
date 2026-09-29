"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useStore } from "@/components/Providers";
import useCartProducts from "@/components/useCartProducts";
import Icon from "@/components/Icon";
import OrderReceipt from "@/components/OrderReceipt";
import NotifyButton from "@/components/NotifyButton";
import { followMyOrders, watchOrder } from "@/lib/push";
import { whatsappPlacedOrderLink } from "@/lib/whatsapp";
import {
  downloadBill,
  formatMoney,
  itemName,
  orderFromRow,
} from "@/lib/format";
import {
  cartTotals,
  clearBuyNow,
  readBuyNow,
  validateCustomer,
} from "@/lib/cart";
export default function CheckoutPage() {
  const { supabase, currentUser, profile, authReady, clearCart } = useStore();
  // /checkout?buy=1 (from "Buy now") checks out that one item; the basket stays.
  const [buyNow, setBuyNow] = useState(undefined);
  useEffect(() => {
    const buy = new URLSearchParams(window.location.search).get("buy");
    setBuyNow(buy ? readBuyNow() : null);
  }, []);
  const { lines, settings, loading, error, invalid, retry } = useCartProducts(
    buyNow || undefined,
  );
  const backHref = buyNow ? `/product/${buyNow[0].productId}` : "/cart";
  const [form, setForm] = useState({
    name: "",
    phone: "",
    address: "",
    city: "",
    notes: "",
  });
  const [order, setOrder] = useState(null),
    [submitting, setSubmitting] = useState(false),
    [submitError, setSubmitError] = useState("");
  // A discount code checked against the basket; the database applies it again
  // (and may still refuse it) when the order is placed.
  const [couponInput, setCouponInput] = useState(""),
    [coupon, setCoupon] = useState(null),
    [couponError, setCouponError] = useState(""),
    [checkingCoupon, setCheckingCoupon] = useState(false);
  const busy = useRef(false),
    request = useRef(null);
  useEffect(() => {
    setForm((f) => ({
      ...f,
      name: f.name || profile?.name || "",
      phone: f.phone || profile?.phone || "",
    }));
  }, [profile]);
  const valid = lines.filter((l) => l.product),
    subtotal = cartTotals(valid).subtotal,
    discount = coupon ? Math.min(coupon.discount, subtotal) : 0,
    totals = cartTotals(
      valid,
      settings.shippingFee,
      settings.freeDeliveryOver,
      discount,
    ),
    money = (n) => formatMoney(n, settings.currencySymbol);
  async function applyCoupon() {
    const code = couponInput.trim().toUpperCase();
    if (!code || !supabase || checkingCoupon) return;
    setCheckingCoupon(true);
    setCouponError("");
    try {
      const { data, error } = await supabase.rpc("check_coupon", {
        p_code: code,
        p_subtotal: totals.subtotal,
      });
      if (error) throw error;
      setCoupon({ code: data.code, discount: Number(data.discount) || 0 });
      setCouponInput("");
    } catch (e) {
      setCoupon(null);
      setCouponError(
        /discount code/i.test(e?.message || "")
          ? e.message
          : "Could not check the code. Please try again.",
      );
    } finally {
      setCheckingCoupon(false);
    }
  }
  async function submit(e) {
    e.preventDefault();
    if (busy.current || invalid || !lines.length || !supabase) return;
    setSubmitError("");
    let customer;
    try {
      customer = validateCustomer(form);
    } catch (e) {
      setSubmitError(e.message);
      return;
    }
    busy.current = true;
    setSubmitting(true);
    const items = lines.map((l) => ({
      productId: l.productId,
      qty: l.qty,
      ...(l.variant && { variant: l.variant }),
    }));
    const fingerprint = JSON.stringify({
      items,
      customer,
      coupon: coupon?.code || "",
      owner: currentUser?.id || null,
    });
    // Retain the request ID after a timeout/reload, so retrying cannot create a duplicate order.
    try {
      const saved = JSON.parse(
        sessionStorage.getItem("al-ammar:checkout-request") || "null",
      );
      if (saved?.fingerprint === fingerprint) request.current = saved;
    } catch {}
    if (request.current?.fingerprint !== fingerprint)
      request.current = { fingerprint, id: crypto.randomUUID() };
    try {
      sessionStorage.setItem(
        "al-ammar:checkout-request",
        JSON.stringify(request.current),
      );
    } catch {}
    try {
      const { data, error } = await supabase.rpc("place_store_order", {
        p_request_id: request.current.id,
        p_items: items,
        p_customer: { ...customer, coupon: coupon?.code || "" },
      });
      if (error) {
        if (/discount code/i.test(error.message)) {
          setCoupon(null);
          throw new Error(
            `${error.message}. It has been removed, please place the order again.`,
          );
        }
        if (error.code === "PGRST202" || error.code === "42883")
          throw new Error(
            "Checkout is temporarily unavailable. Please contact the store or try again later.",
          );
        if (/too many guest orders/i.test(error.message))
          throw new Error(
            "Checkout is very busy right now. Please try again in a few minutes, or sign in to order.",
          );
        if (/too many/i.test(error.message))
          throw new Error(
            "We have received several orders from this number already. Please wait for the store to contact you, or call us to place another order.",
          );
        if (/stock|unavailable|quantity/i.test(error.message))
          throw new Error(
            "Availability has changed. Please return to your basket and check the quantities.",
          );
        throw new Error(
          "We could not confirm your order. Retry with the same details; the same request will not create a duplicate order.",
        );
      }
      if (!data?.id)
        throw new Error("The order could not be confirmed. Please try again.");
      setOrder(orderFromRow(data));
      if (buyNow) clearBuyNow();
      else clearCart();
      request.current = null;
      try {
        sessionStorage.removeItem("al-ammar:checkout-request");
      } catch {}
    } catch (e) {
      setSubmitError(e.message);
    } finally {
      busy.current = false;
      setSubmitting(false);
    }
  }
  if (order)
    return (
      <main className="page-wrap" style={{ maxWidth: 780 }}>
        <div className="empty-state" style={{ border: 0, paddingBottom: 10 }}>
          <span className="brand-mark" style={{ margin: "0 auto 20px" }}>
            <Icon name="check" size={28} />
          </span>
          <span className="eyebrow">THANK YOU, {order.customer.name}</span>
          <h1>Your order is in.</h1>
          <p>We’ll call {order.customer.phone} to confirm your delivery.</p>
        </div>
        <OrderReceipt order={order} settings={settings} />
        <div className="flex gap-3 mt-6 no-print" style={{ flexWrap: "wrap" }}>
          <button
            className="stx-btn stx-btn-outline"
            onClick={() => downloadBill(order.id)}
          >
            <Icon name="download" size={17} /> Download bill (PDF)
          </button>
          <Link
            className="stx-btn stx-btn-outline"
            href={`/track?order=${encodeURIComponent(order.id)}`}
          >
            <Icon name="local_shipping" size={17} /> Track this order
          </Link>
          {whatsappPlacedOrderLink(settings, order) && (
            <a
              className="stx-btn stx-btn-outline"
              href={whatsappPlacedOrderLink(settings, order)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon name="chat" size={17} /> Confirm on WhatsApp
            </a>
          )}
          <Link className="stx-btn stx-btn-primary" href="/">
            Continue shopping
          </Link>
        </div>
        <NotifyButton
          className="mt-6 no-print"
          label="Notify me about this order"
          done="Done. This phone will be notified when your order is confirmed, sent and delivered."
          // Signed in: follow every order on the account; guests: this order.
          enable={() =>
            currentUser
              ? followMyOrders(supabase)
              : watchOrder(supabase, order.id, order.customer.phone)
          }
        />
      </main>
    );
  return (
    <main className="page-wrap">
      <Link href={backHref} className="back-link">
        <Icon name="chevron_left" size={15} />{" "}
        {buyNow ? "Back to the product" : "Back to your basket"}
      </Link>
      <div className="page-heading">
        <span className="eyebrow">ONE LAST LITTLE STEP</span>
        <h1>
          Make it yours<span className="gold-dot">.</span>
        </h1>
        <p>Tell us where to deliver. Pay when your order arrives.</p>
      </div>
      <div className="checkout-steps">
        <Link href={backHref}>{buyNow ? "01 Product" : "01 Basket"}</Link>
        <span>—</span>
        <span className="active">02 Delivery details</span>
        <span>—</span>
        <span>03 Confirmation</span>
      </div>
      {loading || !authReady || buyNow === undefined ? (
        <p role="status">Checking your basket…</p>
      ) : error ? (
        <div className="inline-error" role="alert">
          {error} <button onClick={retry}>Retry</button>
        </div>
      ) : !lines.length ? (
        <div className="empty-state">
          <h2>Your basket is empty.</h2>
          <Link href="/" className="stx-btn stx-btn-primary">
            Explore the collection
          </Link>
        </div>
      ) : invalid ? (
        <div className="inline-error" role="alert">
          Some items are unavailable or exceed current stock.{" "}
          <Link href="/cart">Update your basket</Link>.
        </div>
      ) : (
        <form onSubmit={submit} className="checkout-grid">
          <div>
            <section className="stx-card form-section">
              <h2>Delivery details</h2>
              {!currentUser && (
                <p className="muted small">
                  Shopping as a guest.{" "}
                  <Link href="/auth" style={{ textDecoration: "underline" }}>
                    Sign in
                  </Link>{" "}
                  to keep your order history.
                </p>
              )}
              <div className="form-grid">
                {[
                  { key: "name", label: "Full name", auto: "name", max: 120 },
                  {
                    key: "phone",
                    label: "Phone number",
                    auto: "tel",
                    type: "tel",
                    max: 30,
                  },
                  {
                    key: "address",
                    label: "Street address",
                    auto: "street-address",
                    max: 500,
                    full: true,
                  },
                  {
                    key: "city",
                    label: "City",
                    auto: "address-level2",
                    max: 100,
                    full: true,
                  },
                ].map((f) => (
                  <label
                    key={f.key}
                    className={`form-field ${f.full ? "full" : ""}`}
                  >
                    {f.label}
                    <input
                      className="stx-input"
                      name={f.key}
                      autoComplete={f.auto}
                      type={f.type || "text"}
                      value={form[f.key]}
                      maxLength={f.max}
                      onChange={(e) =>
                        setForm({ ...form, [f.key]: e.target.value })
                      }
                      required
                    />
                  </label>
                ))}
                <label className="form-field full">
                  Delivery notes <span className="muted">(optional)</span>
                  <textarea
                    className="stx-input"
                    rows={3}
                    maxLength={1000}
                    value={form.notes}
                    onChange={(e) =>
                      setForm({ ...form, notes: e.target.value })
                    }
                  />
                </label>
              </div>
            </section>
            <section className="stx-card form-section">
              <h2>Payment</h2>
              <div className="flex items-center gap-3">
                <Icon name="account_balance_wallet" size={24} />
                <div>
                  <strong>Cash on delivery</strong>
                  <p className="muted small" style={{ marginBottom: 0 }}>
                    We’ll call to confirm before dispatch. No online payment is
                    taken.
                  </p>
                </div>
              </div>
            </section>
          </div>
          <aside className="stx-card order-summary">
            <h2>Your order</h2>
            {valid.map((l) => (
              <div
                className="summary-row"
                key={`${l.productId}:${l.variant || ""}`}
              >
                <span>
                  {itemName(l.product.name, l.variant)} × {l.qty}
                </span>
                <span>{money(l.product.price * l.qty)}</span>
              </div>
            ))}
            {coupon ? (
              <div className="summary-row discount">
                <span>
                  Discount ({coupon.code}){" "}
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setCoupon(null)}
                  >
                    Remove
                  </button>
                </span>
                <span>− {money(discount)}</span>
              </div>
            ) : (
              <div className="coupon-box">
                <input
                  className="stx-input"
                  aria-label="Discount code"
                  placeholder="Discount code"
                  value={couponInput}
                  maxLength={30}
                  autoCapitalize="characters"
                  onChange={(e) => setCouponInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      applyCoupon();
                    }
                  }}
                />
                <button
                  type="button"
                  className="stx-btn stx-btn-outline"
                  disabled={!couponInput.trim() || checkingCoupon}
                  onClick={applyCoupon}
                >
                  {checkingCoupon ? "Checking…" : "Apply"}
                </button>
              </div>
            )}
            {couponError && (
              <p className="inline-error" role="alert">
                {couponError}
              </p>
            )}
            <div className="summary-row">
              <span>Delivery</span>
              <span>{totals.shipping ? money(totals.shipping) : "Free"}</span>
            </div>
            <div className="summary-row total">
              <span>Total</span>
              <span>{money(totals.total - discount)}</span>
            </div>
            <p className="muted small">
              The latest prices and stock are verified when you place the order.
              By ordering you agree to our{" "}
              <Link href="/policies/terms">terms</Link>,{" "}
              <Link href="/policies/shipping">shipping</Link> and{" "}
              <Link href="/policies/returns">returns</Link> policies.
            </p>
            {submitError && (
              <div className="inline-error" role="alert">
                {submitError}
              </div>
            )}
            <button
              disabled={submitting}
              className="stx-btn stx-btn-primary"
              type="submit"
            >
              {submitting ? "Confirming your order…" : "Place order"}{" "}
              <Icon name="arrow_forward" />
            </button>
            <p className="summary-note">
              Pay on delivery · Keep this page open until confirmed
            </p>
          </aside>
        </form>
      )}
    </main>
  );
}
