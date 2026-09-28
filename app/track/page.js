"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useStore } from "@/components/Providers";
import Icon from "@/components/Icon";
import { formatMoney, formatOrderTime } from "@/lib/format";

const STEPS = [
  { status: "Pending", label: "Order placed" },
  { status: "Confirmed", label: "Confirmed" },
  { status: "Shipped", label: "On its way" },
  { status: "Delivered", label: "Delivered" },
];

// Order tracking for everyone, including guests: order number + phone number.
export default function TrackOrderPage() {
  const { supabase } = useStore();
  const [form, setForm] = useState({ order: "", phone: "" });
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // /track?order=AA-10001 (from the order confirmation) fills in the number.
  useEffect(() => {
    const order = new URLSearchParams(window.location.search).get("order");
    if (order) setForm((f) => ({ ...f, order: order.slice(0, 64) }));
  }, []);

  async function submit(e) {
    e.preventDefault();
    if (busy || !supabase) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const { data, error } = await supabase.rpc("track_order", {
        p_order_id: form.order,
        p_phone: form.phone,
      });
      if (error) throw error;
      if (!data)
        setError(
          "We couldn’t find an order with that number and phone number. Please check both and try again.",
        );
      else setResult(data);
    } catch {
      setError("Could not connect. Please check your internet and try again.");
    } finally {
      setBusy(false);
    }
  }

  const reached = result
    ? STEPS.findIndex((s) => s.status === result.status)
    : -1;

  return (
    <main className="page-wrap" style={{ maxWidth: 640 }}>
      <span className="eyebrow">ORDER TRACKING</span>
      <h1 className="stx-display" style={{ margin: "8px 0 6px" }}>
        Where is my order?
      </h1>
      <p style={{ color: "var(--ink-soft)", marginTop: 0 }}>
        Enter your order number (for example AA-10001) and the phone number you
        ordered with.
      </p>

      <form onSubmit={submit} className="stx-card px-5 py-5">
        <label className="form-field">
          Order number
          <input
            className="stx-input"
            value={form.order}
            maxLength={64}
            placeholder="AA-10001"
            autoCapitalize="characters"
            onChange={(e) => setForm({ ...form, order: e.target.value })}
            required
          />
        </label>
        <label className="form-field">
          Phone number
          <input
            className="stx-input"
            type="tel"
            autoComplete="tel"
            value={form.phone}
            maxLength={30}
            placeholder="03XX XXXXXXX"
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            required
          />
        </label>
        {error && (
          <div className="inline-error" role="alert">
            {error}
          </div>
        )}
        <button
          className="stx-btn stx-btn-primary"
          disabled={busy || !supabase}
          style={{ marginTop: 8 }}
        >
          <Icon name="search" size={17} /> {busy ? "Checking…" : "Track order"}
        </button>
      </form>

      {result && (
        <section
          className="stx-card px-5 py-5"
          style={{ marginTop: 20 }}
          aria-live="polite"
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <strong className="stx-mono">{result.id}</strong>
            <span style={{ color: "var(--ink-soft)", fontSize: ".9rem" }}>
              {formatOrderTime(result.createdAt)}
            </span>
          </div>

          {result.status === "Cancelled" ? (
            <p className="inline-error" role="status" style={{ marginTop: 14 }}>
              This order was cancelled. If you did not expect this, please
              message us on WhatsApp.
            </p>
          ) : (
            <ol className="track-steps">
              {STEPS.map((step, i) => (
                <li
                  key={step.status}
                  className={
                    i < reached ? "done" : i === reached ? "current" : ""
                  }
                >
                  <span className="track-dot">
                    {i <= reached && <Icon name="check" size={13} />}
                  </span>
                  {step.label}
                </li>
              ))}
            </ol>
          )}

          {result.items.map((it, i) => (
            <div key={i} className="track-line">
              <span>
                {it.name} × {it.qty}
              </span>
              <span className="stx-mono">{formatMoney(it.price * it.qty)}</span>
            </div>
          ))}
          <div className="track-line">
            <span>Delivery</span>
            <span className="stx-mono">{formatMoney(result.shippingFee)}</span>
          </div>
          <div className="track-line track-total">
            <span>Total (cash on delivery)</span>
            <span className="stx-mono">{formatMoney(result.total)}</span>
          </div>
        </section>
      )}

      <p style={{ color: "var(--ink-soft)", fontSize: ".9rem", marginTop: 20 }}>
        Have an account? <Link href="/account">See all your orders</Link>.
      </p>
    </main>
  );
}
