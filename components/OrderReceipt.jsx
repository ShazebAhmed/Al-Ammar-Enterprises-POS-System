import { formatMoney, formatOrderTime, itemName } from "@/lib/format";
import { billPolicySummary } from "@/lib/policies";

const STATUS_LABEL = {
  Pending: "Awaiting confirmation",
  Confirmed: "Confirmed",
  Shipped: "On its way",
  Delivered: "Delivered",
  Cancelled: "Cancelled",
};

// The customer's bill. Printed on its own (see .receipt in globals.css), so
// "Save as PDF" in the print dialog gives a one-page branded invoice.
export default function OrderReceipt({ order, settings }) {
  const money = (n) => formatMoney(n, settings.currencySymbol);
  const storeName = settings.storeName || "Al-Ammar";
  const initial = (settings.logoInitial || storeName).trim().charAt(0) || "A";
  const contact = [settings.contactPhone, settings.whatsapp]
    .filter(Boolean)
    .filter((v, i, all) => all.indexOf(v) === i);
  const customer = order.customer || {};
  // The bill is only rendered in the browser (after checkout or on request).
  const host = typeof window === "undefined" ? "" : window.location.host;
  return (
    <article className="receipt" aria-label={`Bill for order ${order.id}`}>
      <header className="receipt-head">
        <div className="receipt-brand">
          <span className="receipt-mono" aria-hidden="true">
            {initial}
          </span>
          <div>
            <div className="receipt-store">{storeName}</div>
            <div className="receipt-tagline">
              {settings.tagline || "The everyday, elevated"}
            </div>
          </div>
        </div>
        <div className="receipt-title">
          <span>Invoice</span>
          <strong>{order.id}</strong>
        </div>
      </header>

      <div className="receipt-body">
        <dl className="receipt-meta">
          <div>
            <dt>Date &amp; time</dt>
            <dd>{formatOrderTime(order.createdAt)}</dd>
          </div>
          <div>
            <dt>Payment</dt>
            <dd>Cash on delivery</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>
              <span className={`receipt-status is-${order.status}`}>
                {STATUS_LABEL[order.status] || order.status}
              </span>
            </dd>
          </div>
        </dl>

        <div className="receipt-parties">
          <section>
            <h3>Billed to</h3>
            <p className="receipt-name">{customer.name}</p>
            <p>{customer.phone}</p>
            <p>
              {customer.address}
              {customer.city ? `, ${customer.city}` : ""}
            </p>
          </section>
          <section>
            <h3>From</h3>
            <p className="receipt-name">{storeName}</p>
            {contact.map((c) => (
              <p key={c}>{c}</p>
            ))}
            <p>Delivered to your door</p>
          </section>
        </div>

        <table className="receipt-items">
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Item</th>
              <th scope="col">Qty</th>
              <th scope="col">Price</th>
              <th scope="col">Amount</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((it, i) => (
              <tr key={`${it.productId}-${i}`}>
                <td>{String(i + 1).padStart(2, "0")}</td>
                <td>{itemName(it.name, it.variant)}</td>
                <td>{it.qty}</td>
                <td>{money(it.price)}</td>
                <td>{money(it.price * it.qty)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="receipt-summary">
          <div className="receipt-note">
            {customer.notes ? (
              <>
                <h3>Your note</h3>
                <p>{customer.notes}</p>
              </>
            ) : (
              <p>
                We will call {customer.phone || "you"} to confirm before
                dispatch. Please keep the exact amount ready on delivery.
              </p>
            )}
          </div>
          <dl className="receipt-totals">
            <div>
              <dt>Subtotal</dt>
              <dd>{money(order.subtotal)}</dd>
            </div>
            {order.discount > 0 && (
              <div>
                <dt>
                  Discount{order.couponCode ? ` (${order.couponCode})` : ""}
                </dt>
                <dd>− {money(order.discount)}</dd>
              </div>
            )}
            <div>
              <dt>Delivery</dt>
              <dd>{money(order.shippingFee)}</dd>
            </div>
            <div className="receipt-grand">
              <dt>Total due</dt>
              <dd>{money(order.total)}</dd>
            </div>
          </dl>
        </div>
      </div>

      <p className="receipt-policy">
        {billPolicySummary()} Full policy: {host}/policies/returns
      </p>
      <footer className="receipt-foot">
        <p className="receipt-thanks">Thank you</p>
        <p>
          for shopping with {storeName}
          {contact[0] ? ` · Questions? ${contact[0]}` : ""}
        </p>
        <p className="receipt-small">
          Computer-generated bill · No signature required
        </p>
      </footer>
    </article>
  );
}
