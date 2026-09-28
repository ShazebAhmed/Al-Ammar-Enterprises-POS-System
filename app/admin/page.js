"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore } from "@/components/Providers";
import Icon from "@/components/Icon";
import NotifyButton from "@/components/NotifyButton";
import { watchNewOrders } from "@/lib/push";
import StarRow from "@/components/StarRow";
import {
  formatMoney,
  formatOrderTime,
  compressImage,
  uid,
  settingsFromRow,
  settingsToRow,
  DEFAULT_SETTINGS,
  productFromRow,
  orderFromRow,
  reviewFromRow,
  ORDER_STATUSES,
  STATUS_COLOR,
} from "@/lib/format";
const ADMIN_TABS = [
  { key: "overview", label: "Overview", icon: "dashboard" },
  { key: "products", label: "Products", icon: "inventory_2" },
  { key: "orders", label: "Orders", icon: "list_alt" },
  { key: "customers", label: "Customers", icon: "group" },
  { key: "reviews", label: "Reviews", icon: "chat" },
  { key: "settings", label: "Settings", icon: "settings" },
];
const DAY_MS = 24 * 60 * 60 * 1000;
// Pending cash-on-delivery orders older than this are flagged so their stock can be released.
const STALE_ORDER_DAYS = 3;
export default function AdminPage() {
  const {
    supabase,
    currentUser,
    profile,
    isAdmin,
    authReady,
    profileReady,
    notify,
    inStoreApp,
  } = useStore();
  const router = useRouter();
  const [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState(""),
    [revision, setRevision] = useState(0);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS),
    [products, setProducts] = useState([]),
    [orders, setOrders] = useState([]),
    [reviews, setReviews] = useState([]),
    [tab, setTab] = useState("overview"),
    [editingProduct, setEditingProduct] = useState(null),
    [mobileNavOpen, setMobileNavOpen] = useState(false);
  useEffect(() => {
    if (authReady && !currentUser && supabase)
      router.replace("/auth?next=/admin");
  }, [authReady, currentUser, supabase, router]);
  useEffect(() => {
    if (!authReady || !profileReady) return;
    if (!isAdmin || !supabase) {
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    setLoadError("");
    async function allRows(table) {
      let all = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await supabase
          .from(table)
          .select("*")
          .order("created_at", { ascending: false })
          .order("id")
          .range(offset, offset + 499);
        if (error) throw error;
        all.push(...data);
        if (data.length < 500) return all;
      }
    }
    (async () => {
      try {
        const [s, p, o, r] = await Promise.all([
          supabase.from("store_settings").select("*").eq("id", 1).maybeSingle(),
          allRows("products"),
          allRows("orders"),
          allRows("reviews"),
        ]);
        if (s.error) throw s.error;
        if (!alive) return;
        setSettings(s.data ? settingsFromRow(s.data) : DEFAULT_SETTINGS);
        setProducts(p.map(productFromRow));
        setOrders(o.map(orderFromRow));
        setReviews(r.map(reviewFromRow));
      } catch {
        if (alive)
          setLoadError(
            "Could not load dashboard data. Please check your connection and retry.",
          );
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [authReady, profileReady, isAdmin, supabase, revision]);
  async function mutation(action, message) {
    try {
      await action();
      notify(message);
    } catch (e) {
      notify(
        "The change was not saved. Please check your connection and try again.",
        "error",
      );
      throw e;
    }
  }
  async function updateSettings(patch) {
    await mutation(async () => {
      const row = settingsToRow({
        ...patch,
        shippingFee: Number(patch.shippingFee),
      });
      if (!Number.isFinite(row.shipping_fee) || row.shipping_fee < 0)
        throw new Error("Invalid delivery fee");
      const { error } = await supabase
        .from("store_settings")
        .upsert({ id: 1, ...row });
      if (error) throw error;
      setSettings({
        ...settings,
        ...patch,
        shippingFee: Number(patch.shippingFee),
      });
      router.refresh();
    }, "Store settings saved");
  }
  async function upsertProduct(p) {
    await mutation(async () => {
      if (
        !p.name.trim() ||
        !Number.isFinite(p.price) ||
        p.price < 0 ||
        !Number.isSafeInteger(p.stock) ||
        p.stock < 0
      )
        throw new Error("Invalid product values");
      const row = {
        name: p.name.trim(),
        category: p.category,
        price: p.price,
        stock: p.stock,
        description: p.description,
        images: p.images,
        video_url: p.videoUrl,
      };
      const result = p.id
        ? await supabase
            .from("products")
            .update(row)
            .eq("id", p.id)
            .select()
            .single()
        : await supabase.from("products").insert(row).select().single();
      if (result.error) throw result.error;
      const saved = productFromRow(result.data);
      setProducts((list) =>
        p.id ? list.map((x) => (x.id === p.id ? saved : x)) : [saved, ...list],
      );
      router.refresh();
    }, "Product saved");
  }
  async function deleteProduct(id) {
    await mutation(async () => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
      setProducts((list) => list.filter((p) => p.id !== id));
    }, "Product deleted");
  }
  async function updateOrderStatus(id, status) {
    await mutation(async () => {
      const { error } = await supabase
        .from("orders")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
      setOrders((list) =>
        list.map((o) => (o.id === id ? { ...o, status } : o)),
      );
      setRevision((r) => r + 1);
    }, "Order status updated");
  }
  async function cancelStaleOrders(days) {
    await mutation(async () => {
      const { error } = await supabase.rpc("cancel_stale_orders", {
        p_days: days,
      });
      if (error) throw error;
      const cutoff = Date.now() - days * DAY_MS;
      setOrders((list) =>
        list.map((o) =>
          o.status === "Pending" && new Date(o.createdAt).getTime() < cutoff
            ? { ...o, status: "Cancelled" }
            : o,
        ),
      );
      setRevision((r) => r + 1);
    }, "Old pending orders cancelled");
  }
  async function deleteReview(id) {
    await mutation(async () => {
      const { error } = await supabase.from("reviews").delete().eq("id", id);
      if (error) throw error;
      setReviews((list) => list.filter((r) => r.id !== id));
    }, "Review deleted");
  }
  async function approveReview(id) {
    await mutation(async () => {
      const { error } = await supabase
        .from("reviews")
        .update({ approved: true })
        .eq("id", id);
      if (error) throw error;
      setReviews((list) =>
        list.map((r) => (r.id === id ? { ...r, approved: true } : r)),
      );
    }, "Review approved");
  }
  async function uploadProductImage(blob) {
    const path = `products/${uid("img_")}.jpg`;
    const { error } = await supabase.storage
      .from("product-images")
      .upload(path, blob, {
        contentType: "image/jpeg",
        // Every upload gets a new file name, so phones can keep images for a year.
        cacheControl: "31536000",
      });
    if (error) throw error;
    return supabase.storage.from("product-images").getPublicUrl(path).data
      .publicUrl;
  }
  // Best effort: removes photos no product refers to any more. A failure only
  // leaves an unused file behind, so it is not shown to the admin.
  async function deleteProductImages(urls) {
    const marker = "/object/public/product-images/";
    const paths = urls
      .map((url) => String(url).split(marker)[1])
      .filter(Boolean)
      .map((path) => decodeURIComponent(path.split("?")[0]));
    if (paths.length)
      await supabase.storage
        .from("product-images")
        .remove(paths)
        .catch(() => {});
  }
  if (inStoreApp)
    return (
      <main className="page-wrap empty-state">
        <Icon name="lock" size={36} />
        <h1>Store management</h1>
        <p>
          This app is the shop your customers use. Open the Al Ammar Admin app
          to manage the store.
        </p>
        <Link className="stx-btn stx-btn-primary" href="/">
          Back to the store
        </Link>
      </main>
    );
  if (!authReady || !profileReady || loading)
    return (
      <main className="page-wrap">
        <p role="status">Opening your workspace…</p>
      </main>
    );
  if (!supabase || !isAdmin)
    return (
      <main className="page-wrap empty-state">
        <Icon name="lock" size={36} />
        <h1>Store management</h1>
        <p>
          {!supabase
            ? "The store connection is unavailable."
            : "Sign in with an authorised administrator account to continue."}
        </p>
        <Link className="stx-btn stx-btn-primary" href="/auth?next=/admin">
          Go to sign in
        </Link>
      </main>
    );
  const pending = orders.filter((o) => o.status === "Pending").length;
  const delivered = orders.filter((o) => o.status === "Delivered");
  const revenue = delivered.reduce((s, o) => s + Number(o.total), 0);
  const lowStock = products
    .filter((p) => Number(p.stock) <= 5)
    .sort((a, b) => a.stock - b.stock);
  const customersMap = new Map();
  for (const o of orders) {
    if (!o.customerId) continue;
    const c = customersMap.get(o.customerId) || {
      id: o.customerId,
      name: o.customer.name,
      phone: o.customer.phone,
      orderCount: 0,
    };
    c.orderCount++;
    customersMap.set(o.customerId, c);
  }
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 6 + i);
    const key = d.toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" });
    return {
      key,
      label: d.toLocaleDateString("en-GB", {
        weekday: "short",
        timeZone: "Asia/Karachi",
      }),
      total: orders
        .filter(
          (o) =>
            o.status !== "Cancelled" &&
            new Date(o.createdAt).toLocaleDateString("en-CA", {
              timeZone: "Asia/Karachi",
            }) === key,
        )
        .reduce((s, o) => s + Number(o.total), 0),
    };
  });
  const max = Math.max(...days.map((d) => d.total), 1);
  return (
    <div className="admin-layout">
      <button
        className={`admin-overlay ${mobileNavOpen ? "open" : ""}`}
        onClick={() => setMobileNavOpen(false)}
        aria-label="Close navigation"
      />
      <aside className={`admin-sidebar ${mobileNavOpen ? "open" : ""}`}>
        <Link className="brand" href="/">
          <span className="brand-mark">{settings.logoInitial || "A"}</span>
          <span>
            <strong>{settings.storeName || "Al-Ammar"}</strong>
            <small>STORE WORKSPACE</small>
          </span>
        </Link>
        <span className="nav-label">MANAGE YOUR STORE</span>
        <nav aria-label="Store management">
          {ADMIN_TABS.map((t) => (
            <button
              key={t.key}
              className={tab === t.key ? "active" : ""}
              aria-current={tab === t.key ? "page" : undefined}
              onClick={() => {
                setTab(t.key);
                setMobileNavOpen(false);
              }}
            >
              <Icon name={t.icon} size={18} />
              {t.label}
              {t.key === "orders" && pending > 0 && (
                <span className="nav-count">{pending}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="admin-sidebar-bottom">
          <Link href="/">
            <Icon name="arrow_forward" size={16} /> Visit your storefront
          </Link>
        </div>
      </aside>
      <div className="admin-main">
        <header className="admin-topbar">
          <button
            className="icon-button menu-toggle"
            aria-label="Open navigation"
            aria-expanded={mobileNavOpen}
            onClick={() => setMobileNavOpen((v) => !v)}
          >
            <Icon name="menu" />
          </button>
          <span>
            Workspace{" "}
            <span className="muted">
              / {ADMIN_TABS.find((t) => t.key === tab)?.label}
            </span>
          </span>
          <div className="flex items-center gap-3">
            <span className="muted small">
              {profile?.name || "Store administrator"}
            </span>
            <span className="admin-avatar">
              {(profile?.name || "A").charAt(0).toUpperCase()}
            </span>
          </div>
        </header>
        <main className="admin-content">
          {loadError ? (
            <div className="inline-error" role="alert">
              {loadError}{" "}
              <button onClick={() => setRevision((r) => r + 1)}>Retry</button>
            </div>
          ) : (
            <>
              {tab === "overview" && (
                <>
                  <div className="admin-page-heading">
                    <div>
                      <span className="eyebrow muted">
                        YOUR STORE AT A GLANCE
                      </span>
                      <h1>
                        A good day to grow<span className="gold-dot">.</span>
                      </h1>
                      <p>Here’s what’s happening with your store.</p>
                    </div>
                    <button
                      className="stx-btn stx-btn-primary"
                      onClick={() => setEditingProduct({})}
                    >
                      <Icon name="add" size={16} /> Add product
                    </button>
                  </div>
                  <section className="stx-card px-5 py-4 admin-alerts">
                    <div>
                      <strong>New order alerts</strong>
                      <p className="muted small" style={{ margin: 0 }}>
                        Get a notification on this phone for every new order.
                        Turn it on once on each phone you use.
                      </p>
                    </div>
                    <NotifyButton
                      label="Turn on alerts"
                      done="Alerts are on for this phone."
                      enable={() => watchNewOrders(supabase)}
                    />
                  </section>
                  <div className="admin-stats">
                    <StatCard
                      icon="account_balance_wallet"
                      label="Delivered sales"
                      value={formatMoney(revenue, settings.currencySymbol)}
                      caption="Order value · not profit"
                      accent
                    />
                    <StatCard
                      icon="list_alt"
                      label="Total orders"
                      value={orders.length}
                      caption="All customer orders"
                    />
                    <StatCard
                      icon="fact_check"
                      label="Awaiting confirmation"
                      value={pending}
                      caption="Orders that need your attention"
                    />
                    <StatCard
                      icon="inventory_2"
                      label="Active products"
                      value={products.length}
                      caption={`${lowStock.length} low-stock products`}
                    />
                  </div>
                  <div className="dashboard-columns">
                    <section className="stx-card">
                      <div className="panel-title">
                        <h2>Orders over the last 7 days</h2>
                        <span className="muted small">
                          {settings.currencySymbol}
                        </span>
                      </div>
                      <div
                        className="sales-chart"
                        role="img"
                        aria-label={days
                          .map(
                            (d) =>
                              `${d.label}: ${formatMoney(d.total, settings.currencySymbol)}`,
                          )
                          .join(", ")}
                      >
                        {days.map((d) => (
                          <div className="chart-col" key={d.key}>
                            <div
                              className="chart-bar"
                              style={{
                                height: `${Math.max(2, (d.total / max) * 140)}px`,
                              }}
                              title={formatMoney(
                                d.total,
                                settings.currencySymbol,
                              )}
                            />
                            <small>{d.label}</small>
                          </div>
                        ))}
                      </div>
                      <p className="chart-note">
                        Placed order value, excluding cancelled orders ·
                        Pakistan time
                      </p>
                    </section>
                    <section className="stx-card">
                      <div className="panel-title">
                        <h2>Stock watch</h2>
                        <button onClick={() => setTab("products")}>
                          View all →
                        </button>
                      </div>
                      {lowStock.length ? (
                        lowStock.slice(0, 4).map((p) => (
                          <div className="stock-row" key={p.id}>
                            <Icon name="inventory_2" size={20} />
                            <div>
                              <strong>{p.name}</strong>
                              <small>{p.category}</small>
                            </div>
                            <span>
                              {p.stock === 0 ? "Sold out" : `${p.stock} left`}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="muted small px-5 py-5">
                          {products.length
                            ? "Stock levels look healthy."
                            : "Add your first product to get started."}
                        </p>
                      )}
                    </section>
                  </div>
                  <section className="stx-card">
                    <div className="panel-title">
                      <h2>Recent orders</h2>
                      <button onClick={() => setTab("orders")}>
                        View all orders →
                      </button>
                    </div>
                    <div className="admin-table-wrap">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>Order</th>
                            <th>Customer</th>
                            <th>Date</th>
                            <th>Total</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {orders.slice(0, 6).map((o) => (
                            <tr key={o.id}>
                              <td>{o.id}</td>
                              <td>{o.customer.name}</td>
                              <td>{formatOrderTime(o.createdAt)}</td>
                              <td>
                                {formatMoney(o.total, settings.currencySymbol)}
                              </td>
                              <td>
                                <span
                                  className="status-pill"
                                  style={{ color: STATUS_COLOR[o.status] }}
                                >
                                  {o.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                          {!orders.length && (
                            <tr>
                              <td colSpan={5}>
                                Your first orders will appear here.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </>
              )}
              {tab === "products" && (
                <ProductsTab
                  products={products}
                  settings={settings}
                  onAdd={() => setEditingProduct({})}
                  onEdit={setEditingProduct}
                  onDelete={(id) => deleteProduct(id).catch(() => {})}
                />
              )}
              {tab === "orders" && (
                <OrdersTab
                  orders={orders}
                  settings={settings}
                  onUpdateStatus={(id, status) =>
                    updateOrderStatus(id, status).catch(() => {})
                  }
                  onCancelStale={(days) =>
                    cancelStaleOrders(days).catch(() => {})
                  }
                />
              )}
              {tab === "customers" && (
                <CustomersTab customers={[...customersMap.values()]} />
              )}
              {tab === "reviews" && (
                <ReviewsTab
                  reviews={reviews}
                  products={products}
                  onDelete={(id) => deleteReview(id).catch(() => {})}
                  onApprove={(id) => approveReview(id).catch(() => {})}
                />
              )}
              {tab === "settings" && (
                <SettingsTab settings={settings} onSave={updateSettings} />
              )}
            </>
          )}
        </main>
      </div>
      {editingProduct !== null && (
        <ProductForm
          product={editingProduct}
          categories={settings.categories || []}
          onCancel={() => setEditingProduct(null)}
          onSave={async (p, { addAnother } = {}) => {
            await upsertProduct(p);
            if (!addAnother) setEditingProduct(null);
          }}
          onUploadImage={uploadProductImage}
          onDiscardImages={deleteProductImages}
        />
      )}
    </div>
  );
}
function StatCard({ icon, label, value, caption, accent }) {
  return (
    <article className={`stat-card ${accent ? "accent" : ""}`}>
      <div className="stat-top">
        <span>{label}</span>
        <span className="stat-icon">
          <Icon name={icon} size={17} />
        </span>
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-caption">{caption}</div>
    </article>
  );
}

function ProductsTab({ products, settings, onAdd, onEdit, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [search, setSearch] = useState("");
  const visible = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 18,
        }}
      >
        <div
          className="stx-display"
          style={{ fontSize: "1.4rem", fontWeight: 700 }}
        >
          Products
        </div>
        <button
          onClick={onAdd}
          className="stx-btn stx-btn-primary px-4 py-2 flex items-center gap-2"
          style={{ display: "flex" }}
        >
          <Icon name="add_circle" size={17} color="#fff" /> Add product
        </button>
      </div>
      <div className="admin-tools">
        <input
          className="stx-input"
          aria-label="Search products"
          placeholder="Search products…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {products.length === 0 ? (
        <div className="stx-card px-6 py-12 text-center">
          <Icon name="inventory_2" size={28} color="var(--ink-soft)" />
          <p style={{ color: "var(--ink-soft)", marginTop: 10 }}>
            No products yet. Add your first one to open the store.
          </p>
        </div>
      ) : (
        <div className="stx-card" style={{ overflow: "hidden" }}>
          {visible.map((p, i) => (
            <div
              key={p.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 16px",
                borderTop: i ? "1px solid var(--line)" : "none",
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 8,
                  overflow: "hidden",
                  background: "#EFEBDD",
                  flexShrink: 0,
                }}
              >
                {p.images?.[0] && (
                  <img
                    src={p.images[0]}
                    alt=""
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                )}
              </div>
              <div style={{ flex: 1, minWidth: 120 }}>
                <div style={{ fontWeight: 600, fontSize: ".88rem" }}>
                  {p.name}
                </div>
                <div style={{ fontSize: ".76rem", color: "var(--ink-soft)" }}>
                  {p.category || "Uncategorised"}
                </div>
              </div>
              <div
                className="stx-mono"
                style={{ fontSize: ".85rem", minWidth: 80 }}
              >
                {formatMoney(p.price, settings.currencySymbol)}
              </div>
              <div
                style={{
                  fontSize: ".8rem",
                  color:
                    Number(p.stock) <= 5 ? "var(--brick)" : "var(--ink-soft)",
                  minWidth: 70,
                }}
              >
                {p.stock} in stock
              </div>
              <button
                onClick={() => onEdit(p)}
                className="stx-btn stx-btn-outline"
                style={{
                  padding: "6px 10px",
                  fontSize: ".78rem",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Icon name="edit" size={14} /> Edit
              </button>
              {confirmDelete === p.id ? (
                <div style={{ display: "flex", gap: 4 }}>
                  <button
                    onClick={async () => {
                      await onDelete(p.id);
                      setConfirmDelete(null);
                    }}
                    className="stx-btn"
                    style={{
                      background: "var(--danger)",
                      color: "#fff",
                      padding: "6px 10px",
                      fontSize: ".78rem",
                    }}
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setConfirmDelete(null)}
                    className="stx-btn stx-btn-outline"
                    style={{ padding: "6px 10px", fontSize: ".78rem" }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  aria-label={`Delete ${p.name}`}
                  onClick={() => setConfirmDelete(p.id)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--danger)",
                    cursor: "pointer",
                  }}
                >
                  <Icon name="delete" size={17} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProductForm({
  product,
  categories,
  onCancel,
  onSave,
  onUploadImage,
  onDiscardImages,
}) {
  const isNew = !product.id;
  const [form, setForm] = useState({
    id: product.id || null,
    name: product.name || "",
    category: product.category || categories[0] || "",
    price: product.price ?? "",
    stock: product.stock ?? "",
    description: product.description || "",
    images: product.images || [],
    videoUrl: product.videoUrl || "",
  });
  const [keepDetails, setKeepDetails] = useState(true);
  const [uploads, setUploads] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadNotice, setUploadNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [savedNotice, setSavedNotice] = useState("");
  const fileRef = useRef(null),
    nameRef = useRef(null),
    dialogRef = useRef(null);
  const working = useRef(false),
    alive = useRef(true),
    previews = useRef(new Set()),
    // Photos uploaded in this editor that no saved product refers to yet.
    unsaved = useRef(new Set()),
    // Set by the submit buttons' clicks; SubmitEvent.submitter is missing in
    // older Safari, and pressing Enter should save and close.
    addAnotherClicked = useRef(false);
  function cancel() {
    if (working.current) return;
    onDiscardImages([...unsaved.current]);
    unsaved.current.clear();
    onCancel();
  }
  const cancelRef = useRef(cancel);
  cancelRef.current = cancel;
  function releasePreview(url) {
    if (url) {
      URL.revokeObjectURL(url);
      previews.current.delete(url);
    }
  }
  useEffect(() => {
    alive.current = true;
    const previous = document.activeElement;
    const node = dialogRef.current;
    const focusable = () =>
      Array.from(
        node.querySelectorAll(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
        ),
      ).filter((el) => el.offsetParent !== null);
    nameRef.current?.focus();
    function keydown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        cancelRef.current();
      }
      if (event.key !== "Tab") return;
      const items = focusable(),
        first = items[0],
        last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    node.addEventListener("keydown", keydown);
    return () => {
      alive.current = false;
      node.removeEventListener("keydown", keydown);
      previews.current.forEach((url) => URL.revokeObjectURL(url));
      previews.current.clear();
      previous?.focus();
    };
  }, []);

  async function uploadBatch(entries) {
    if (working.current) return;
    working.current = true;
    setUploading(true);
    setSavedNotice("");
    try {
      for (const entry of entries) {
        if (!alive.current) break;
        setUploads((list) =>
          list.map((item) =>
            item.id === entry.id
              ? { ...item, status: "uploading", error: "" }
              : item,
          ),
        );
        try {
          if (!entry.file.type.startsWith("image/"))
            throw new Error("Choose an image file.");
          if (entry.file.size > 10 * 1024 * 1024)
            throw new Error("Choose an image under 10 MB.");
          const blob = await compressImage(entry.file);
          const url = await onUploadImage(blob);
          unsaved.current.add(url);
          if (!alive.current) break;
          // Keep each successful upload even when a later image fails.
          setForm((current) => ({
            ...current,
            images: [...current.images, url],
          }));
          setUploads((list) => list.filter((item) => item.id !== entry.id));
          releasePreview(entry.preview);
        } catch (error) {
          if (!alive.current) break;
          const status = Number(error?.statusCode || error?.status);
          const message = error?.message || "";
          const reason = message.startsWith("Choose an image")
            ? message
            : status === 403 ||
                /row.level security|unauthoriz|permission/i.test(message)
              ? "Upload permission denied. Check your admin access, then retry."
              : /bucket.*not found/i.test(message)
                ? "Image storage is unavailable. Check the store's storage setup."
                : "Could not upload this image. Check your connection or try a different image.";
          setUploads((list) =>
            list.map((item) =>
              item.id === entry.id
                ? { ...item, status: "failed", error: reason }
                : item,
            ),
          );
        }
      }
    } finally {
      working.current = false;
      if (alive.current) setUploading(false);
    }
  }
  async function handleFiles(event) {
    const selected = Array.from(event.target.files || []);
    event.target.value = "";
    if (working.current || !selected.length) return;
    const slots = Math.max(0, 5 - form.images.length - uploads.length);
    const files = selected.slice(0, slots);
    setUploadNotice(
      selected.length > slots
        ? `Only ${slots} more ${slots === 1 ? "photo can" : "photos can"} be added. The extra files were not uploaded.`
        : "",
    );
    if (!files.length) return;
    const entries = files.map((file) => {
      const preview =
        file.type.startsWith("image/") && file.size <= 10 * 1024 * 1024
          ? URL.createObjectURL(file)
          : "";
      if (preview) previews.current.add(preview);
      return { id: uid("upload_"), file, preview, status: "queued", error: "" };
    });
    setUploads((list) => [...list, ...entries]);
    await uploadBatch(entries);
  }
  function removePending(entry) {
    if (working.current) return;
    releasePreview(entry.preview);
    setUploads((list) => list.filter((item) => item.id !== entry.id));
    setUploadNotice("");
  }
  function removeImage(index) {
    if (working.current) return;
    // Photos already saved on the product are deleted only after the product
    // is saved without them, so cancelling keeps them.
    const url = form.images[index];
    if (unsaved.current.delete(url)) onDiscardImages([url]);
    setForm((current) => ({
      ...current,
      images: current.images.filter((_, i) => i !== index),
    }));
    setUploadNotice("");
  }
  const canSave =
    form.name.trim() &&
    form.category &&
    form.price !== "" &&
    Number.isFinite(Number(form.price)) &&
    Number(form.price) >= 0 &&
    form.stock !== "" &&
    Number.isSafeInteger(Number(form.stock)) &&
    Number(form.stock) >= 0 &&
    !uploading &&
    uploads.length === 0;
  async function save(event) {
    event.preventDefault();
    if (!canSave || working.current) return;
    const addAnother = isNew && addAnotherClicked.current;
    addAnotherClicked.current = false;
    const submitted = {
      ...form,
      name: form.name.trim(),
      price: Number(form.price),
      stock: Number(form.stock),
    };
    working.current = true;
    setSaving(true);
    setSaveError("");
    setSavedNotice("");
    try {
      await onSave(submitted, { addAnother });
      unsaved.current.clear();
      const dropped = (product.images || []).filter(
        (url) => !submitted.images.includes(url),
      );
      if (form.id && dropped.length) onDiscardImages(dropped);
      if (addAnother && alive.current) {
        setForm({
          id: null,
          name: "",
          category: keepDetails ? submitted.category : categories[0] || "",
          price: keepDetails ? submitted.price : "",
          stock: keepDetails ? submitted.stock : "",
          description: keepDetails ? submitted.description : "",
          images: [],
          videoUrl: "",
        });
        setUploadNotice("");
        setSavedNotice(
          `Saved “${submitted.name}”. Ready for the next product.`,
        );
      }
    } catch {
      if (alive.current)
        setSaveError(
          "Couldn't save this product. Your details and uploaded photos are kept here; check your connection and try again.",
        );
    } finally {
      working.current = false;
      if (alive.current) setSaving(false);
    }
  }
  useEffect(() => {
    if (savedNotice && !saving) nameRef.current?.focus();
  }, [savedNotice, saving]);
  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Product editor"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(20,35,31,.5)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        overflowY: "auto",
        padding: "24px 12px",
        zIndex: 200,
      }}
    >
      <form
        onSubmit={save}
        className="stx-card"
        style={{ width: "min(600px,100%)", padding: 0 }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "16px 20px",
            borderBottom: "1px solid var(--line)",
          }}
        >
          <h2 style={{ fontSize: "1.1rem", margin: 0 }}>
            {isNew ? "Add product" : "Edit product"}
          </h2>
          <button
            type="button"
            aria-label="Close product editor"
            disabled={saving || uploading}
            onClick={cancel}
            className="icon-button"
          >
            <Icon name="close" size={22} />
          </button>
        </div>
        <fieldset
          disabled={saving}
          style={{
            border: 0,
            margin: 0,
            padding: 20,
            display: "flex",
            flexDirection: "column",
            gap: 14,
            maxHeight: "68vh",
            overflowY: "auto",
            minWidth: 0,
          }}
        >
          {savedNotice && (
            <p role="status" style={{ color: "var(--primary)", margin: 0 }}>
              {savedNotice}
            </p>
          )}
          <label className="stx-label" htmlFor="product-name">
            Product name
            <input
              ref={nameRef}
              id="product-name"
              className="stx-input"
              style={{ marginTop: 4 }}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </label>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <label
              className="stx-label"
              style={{ flex: "1 1 160px" }}
              htmlFor="product-price"
            >
              Price
              <input
                id="product-price"
                type="number"
                min="0"
                step="0.01"
                className="stx-input"
                style={{ marginTop: 4 }}
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                required
              />
            </label>
            <label
              className="stx-label"
              style={{ flex: "1 1 160px" }}
              htmlFor="product-stock"
            >
              Stock quantity
              <input
                id="product-stock"
                type="number"
                min="0"
                step="1"
                className="stx-input"
                style={{ marginTop: 4 }}
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: e.target.value })}
                required
              />
            </label>
          </div>
          <label className="stx-label" htmlFor="product-category">
            Category
            <select
              id="product-category"
              className="stx-input"
              style={{ marginTop: 4 }}
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {!categories.includes(form.category) && (
                <option value={form.category}>
                  {form.category || "Choose a category"}
                </option>
              )}
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
          <small
            style={{
              color: form.category ? "var(--ink-soft)" : "var(--danger)",
            }}
          >
            {categories.length
              ? form.category
                ? "Add new categories in Settings → Categories."
                : "Choose a category to save this product."
              : "Add a category in Settings → Categories before adding products."}
          </small>
          <label className="stx-label" htmlFor="product-description">
            Description
            <textarea
              id="product-description"
              className="stx-input"
              rows={3}
              style={{ marginTop: 4 }}
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </label>
          <section aria-label="Product photos">
            <div className="stx-label">
              Photos ({form.images.length + uploads.length}/5)
            </div>
            <p
              style={{
                fontSize: ".8rem",
                color: "var(--ink-soft)",
                margin: "6px 0 10px",
              }}
            >
              Select several photos together. Up to 10 MB each. The first
              uploaded photo is the cover.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {form.images.map((url, index) => (
                <div key={url} style={{ width: 100 }}>
                  <img
                    src={url}
                    alt={`Product photo ${index + 1}`}
                    style={{
                      width: 100,
                      height: 90,
                      borderRadius: 8,
                      objectFit: "cover",
                    }}
                  />
                  <button
                    type="button"
                    className="text-button"
                    disabled={uploading}
                    aria-label={`Remove photo ${index + 1}`}
                    onClick={() => removeImage(index)}
                  >
                    Remove {index === 0 ? "cover" : "photo"}
                  </button>
                </div>
              ))}
              {uploads.map((entry) => (
                <div
                  key={entry.id}
                  style={{
                    width: 140,
                    overflowWrap: "anywhere",
                    fontSize: ".78rem",
                  }}
                >
                  {entry.preview && (
                    <img
                      src={entry.preview}
                      alt={`Preview of ${entry.file.name}`}
                      style={{
                        width: 100,
                        height: 90,
                        borderRadius: 8,
                        objectFit: "cover",
                      }}
                    />
                  )}
                  <div>{entry.file.name}</div>
                  {entry.error ? (
                    <p
                      role="alert"
                      style={{ color: "var(--danger)", margin: "6px 0" }}
                    >
                      {entry.error}
                    </p>
                  ) : (
                    <p role="status">
                      {entry.status === "uploading" ? "Uploading…" : "Waiting…"}
                    </p>
                  )}
                  <div style={{ display: "flex", gap: 10 }}>
                    {entry.status === "failed" && (
                      <button
                        type="button"
                        disabled={uploading}
                        className="text-button"
                        onClick={() => uploadBatch([entry])}
                      >
                        Retry
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={uploading}
                      className="text-button"
                      aria-label={`Remove ${entry.file.name}`}
                      onClick={() => removePending(entry)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <input
              ref={fileRef}
              aria-label="Choose product photos"
              type="file"
              accept="image/*"
              multiple
              disabled={uploading}
              onChange={handleFiles}
              style={{ display: "none" }}
            />
            <button
              type="button"
              className="stx-btn stx-btn-outline"
              style={{ marginTop: 10 }}
              disabled={uploading || form.images.length + uploads.length >= 5}
              onClick={() => fileRef.current?.click()}
            >
              <Icon name="upload" size={17} />{" "}
              {uploading ? "Uploading photos…" : "Choose photos"}
            </button>
            {uploadNotice && (
              <p role="status" style={{ fontSize: ".8rem", marginTop: 8 }}>
                {uploadNotice}
              </p>
            )}
            {!uploading && uploads.length > 0 && (
              <p
                style={{
                  fontSize: ".8rem",
                  color: "var(--danger)",
                  marginTop: 8,
                }}
              >
                Retry or remove failed photos before saving.
              </p>
            )}
          </section>
          <label className="stx-label" htmlFor="product-video">
            Video link (optional)
            <input
              id="product-video"
              className="stx-input"
              style={{ marginTop: 4 }}
              placeholder="YouTube link, or a direct .mp4 URL"
              value={form.videoUrl}
              onChange={(e) => setForm({ ...form, videoUrl: e.target.value })}
            />
          </label>
          {isNew && (
            <label
              style={{
                fontSize: ".82rem",
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
              }}
            >
              <input
                type="checkbox"
                checked={keepDetails}
                onChange={(e) => setKeepDetails(e.target.checked)}
              />
              <span>
                Keep category, price, stock and description when adding another
                product. Name, photos and video are cleared.
              </span>
            </label>
          )}
        </fieldset>
        {saveError && (
          <p
            role="alert"
            style={{
              padding: "0 20px",
              color: "var(--danger)",
              fontSize: ".82rem",
            }}
          >
            {saveError}
          </p>
        )}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            padding: 20,
            borderTop: "1px solid var(--line)",
          }}
        >
          <button
            type="button"
            disabled={saving || uploading}
            onClick={cancel}
            className="stx-btn stx-btn-outline"
          >
            Cancel
          </button>
          <button
            type="submit"
            value="close"
            disabled={!canSave || saving}
            className="stx-btn stx-btn-primary"
            onClick={() => (addAnotherClicked.current = false)}
          >
            {saving ? "Saving…" : "Save product"}
          </button>
          {isNew && (
            <button
              type="submit"
              value="another"
              disabled={!canSave || saving}
              className="stx-btn stx-btn-outline"
              onClick={() => (addAnotherClicked.current = true)}
            >
              Save &amp; add another
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

/* ---------------------------------------------------------------------
   ORDERS TAB
--------------------------------------------------------------------- */
function OrdersTab({ orders, settings, onUpdateStatus, onCancelStale }) {
  const [expanded, setExpanded] = useState(null);
  const pendingDays = (o) =>
    Math.floor((Date.now() - new Date(o.createdAt).getTime()) / DAY_MS);
  const stale = orders.filter(
    (o) => o.status === "Pending" && pendingDays(o) >= STALE_ORDER_DAYS,
  ).length;
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const visible = orders.filter(
    (o) =>
      (filter === "All" || o.status === filter) &&
      `${o.id} ${o.customer.name} ${o.customer.phone}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <div>
      <div
        className="stx-display"
        style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: 18 }}
      >
        Orders
      </div>
      {stale > 0 && (
        <div
          className="stx-card px-4 py-3"
          role="status"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 14,
          }}
        >
          <span style={{ flex: 1, fontSize: ".86rem" }}>
            {stale} pending {stale === 1 ? "order has" : "orders have"} waited
            {` ${STALE_ORDER_DAYS}`} days or more. Their stock is still
            reserved.
          </span>
          <button
            type="button"
            className="stx-btn px-3 py-1"
            style={{ fontSize: ".8rem" }}
            onClick={() => {
              if (
                window.confirm(
                  `Cancel ${stale} pending ${stale === 1 ? "order" : "orders"} older than ${STALE_ORDER_DAYS} days? Their stock will return to the shop.`,
                )
              )
                onCancelStale(STALE_ORDER_DAYS);
            }}
          >
            Cancel old pending orders
          </button>
        </div>
      )}
      <div className="admin-tools">
        <input
          className="stx-input"
          aria-label="Search orders"
          placeholder="Search order, name or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="stx-input"
          aria-label="Filter order status"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          {["All", ...ORDER_STATUSES].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>
      {visible.length === 0 ? (
        <div className="stx-card px-6 py-12 text-center">
          <Icon name="list_alt" size={28} color="var(--ink-soft)" />
          <p style={{ color: "var(--ink-soft)", marginTop: 10 }}>
            No orders yet.
          </p>
        </div>
      ) : (
        <div className="stx-card" style={{ overflow: "hidden" }}>
          {visible.map((o, i) => (
            <div
              key={o.id}
              style={{ borderTop: i ? "1px solid var(--line)" : "none" }}
            >
              <button
                onClick={() => setExpanded(expanded === o.id ? null : o.id)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "13px 16px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  flexWrap: "wrap",
                }}
              >
                <span
                  className="stx-mono"
                  style={{ fontSize: ".82rem", minWidth: 110 }}
                >
                  {o.id}
                </span>
                <span style={{ flex: 1, fontSize: ".85rem", fontWeight: 600 }}>
                  {o.customer.name}
                </span>
                <span style={{ fontSize: ".78rem", color: "var(--ink-soft)" }}>
                  {formatOrderTime(o.createdAt)}
                  {o.status === "Pending" && pendingDays(o) >= 1 && (
                    <span
                      style={{
                        marginLeft: 6,
                        color:
                          pendingDays(o) >= STALE_ORDER_DAYS
                            ? "var(--danger)"
                            : "inherit",
                      }}
                    >
                      · pending {pendingDays(o)}d
                    </span>
                  )}
                </span>
                <span
                  className="stx-mono"
                  style={{
                    fontSize: ".85rem",
                    minWidth: 80,
                    textAlign: "right",
                  }}
                >
                  {formatMoney(o.total, settings.currencySymbol)}
                </span>
                <span
                  style={{
                    fontSize: ".75rem",
                    fontWeight: 700,
                    color: STATUS_COLOR[o.status],
                    minWidth: 80,
                    textAlign: "right",
                  }}
                >
                  {o.status}
                </span>
              </button>
              {expanded === o.id && (
                <div
                  style={{
                    padding: "0 16px 16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: 24,
                      flexWrap: "wrap",
                      fontSize: ".85rem",
                    }}
                  >
                    <div>
                      <Icon
                        name="call"
                        size={13}
                        style={{ verticalAlign: "middle", marginRight: 4 }}
                      />
                      {o.customer.phone}
                    </div>
                    <div>
                      <Icon
                        name="location_on"
                        size={13}
                        style={{ verticalAlign: "middle", marginRight: 4 }}
                      />
                      {o.customer.address}, {o.customer.city}
                    </div>
                  </div>
                  {o.customer.notes && (
                    <div
                      style={{ fontSize: ".82rem", color: "var(--ink-soft)" }}
                    >
                      Note: {o.customer.notes}
                    </div>
                  )}
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 4 }}
                  >
                    {o.items.map((it) => (
                      <div
                        key={it.productId}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: ".82rem",
                        }}
                      >
                        <span>
                          {it.name} × {it.qty}
                        </span>
                        <span className="stx-mono">
                          {formatMoney(
                            it.price * it.qty,
                            settings.currencySymbol,
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginTop: 4,
                    }}
                  >
                    <span className="stx-label">Status</span>
                    <select
                      aria-label={`Status for ${o.id}`}
                      value={o.status}
                      onChange={(e) => onUpdateStatus(o.id, e.target.value)}
                      className="stx-input"
                      style={{ width: "auto" }}
                    >
                      {[
                        o.status,
                        ...({
                          Pending: ["Confirmed", "Cancelled"],
                          Confirmed: ["Shipped", "Cancelled"],
                          Shipped: ["Delivered"],
                          Delivered: [],
                          Cancelled: [],
                        }[o.status] || []),
                      ].map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------
   CUSTOMERS TAB
--------------------------------------------------------------------- */
function CustomersTab({ customers }) {
  return (
    <div>
      <div
        className="stx-display"
        style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: 6 }}
      >
        Customers
      </div>
      <p
        style={{
          fontSize: ".82rem",
          color: "var(--ink-soft)",
          marginBottom: 18,
        }}
      >
        Everyone who has placed at least one order while signed in. If someone
        forgets their password, they can reset it themselves from the sign-in
        screen — it emails them a link.
      </p>
      {customers.length === 0 ? (
        <div className="stx-card px-6 py-12 text-center">
          <Icon name="group" size={26} color="var(--ink-soft)" />
          <p style={{ color: "var(--ink-soft)", marginTop: 10 }}>
            No signed-in customers yet.
          </p>
        </div>
      ) : (
        <div className="stx-card" style={{ overflow: "hidden" }}>
          {customers.map((c, i) => (
            <div
              key={c.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "13px 16px",
                borderTop: i ? "1px solid var(--line)" : "none",
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: ".88rem" }}>
                  {c.name}
                </div>
                <div style={{ fontSize: ".78rem", color: "var(--ink-soft)" }}>
                  {c.phone}
                </div>
              </div>
              <span
                className="stx-mono"
                style={{ fontSize: ".8rem", color: "var(--ink-soft)" }}
              >
                {c.orderCount} order{c.orderCount === 1 ? "" : "s"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------
   REVIEWS TAB
--------------------------------------------------------------------- */
function ReviewsTab({ reviews, products, onDelete, onApprove }) {
  const pending = reviews.filter((r) => !r.approved).length;
  const ordered = [...reviews].sort(
    (a, b) => Number(a.approved) - Number(b.approved),
  );
  return (
    <div>
      <div
        className="stx-display"
        style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: 18 }}
      >
        Reviews
      </div>
      {pending > 0 && (
        <p style={{ color: "var(--ink-soft)", marginBottom: 12 }}>
          {pending} {pending === 1 ? "review is" : "reviews are"} waiting for
          approval. Customers only see approved reviews.
        </p>
      )}
      {reviews.length === 0 ? (
        <div className="stx-card px-6 py-12 text-center">
          <Icon name="chat" size={28} color="var(--ink-soft)" />
          <p style={{ color: "var(--ink-soft)", marginTop: 10 }}>
            No reviews yet.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {ordered.map((r) => {
            const product = products.find((p) => p.id === r.productId);
            return (
              <div
                key={r.id}
                className="stx-card px-4 py-3"
                style={{ display: "flex", gap: 12, alignItems: "flex-start" }}
              >
                <div style={{ flex: 1 }}>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <span style={{ fontWeight: 600, fontSize: ".88rem" }}>
                      {r.name}
                    </span>
                    <StarRow value={r.rating} size={12} />
                    {!r.approved && (
                      <span
                        style={{
                          fontSize: ".72rem",
                          fontWeight: 600,
                          color: "var(--danger)",
                        }}
                      >
                        Awaiting approval
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: ".76rem",
                      color: "var(--ink-soft)",
                      marginTop: 2,
                    }}
                  >
                    on {product ? product.name : "a deleted product"}
                  </div>
                  <p style={{ fontSize: ".84rem", marginTop: 6 }}>
                    {r.comment}
                  </p>
                </div>
                {!r.approved && (
                  <button
                    type="button"
                    className="stx-btn stx-btn-primary px-3 py-1"
                    style={{ fontSize: ".8rem" }}
                    onClick={() => onApprove(r.id)}
                  >
                    Approve
                  </button>
                )}
                <button
                  aria-label="Delete review"
                  onClick={() => {
                    if (window.confirm("Delete this review?")) onDelete(r.id);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--danger)",
                    cursor: "pointer",
                  }}
                >
                  <Icon name="delete" size={16} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------
   SETTINGS TAB
--------------------------------------------------------------------- */
function SettingsTab({ settings, onSave }) {
  const [form, setForm] = useState({ ...settings });
  const [newCategory, setNewCategory] = useState("");
  const [saveStatus, setSaveStatus] = useState(null); // null | "saving" | "saved" | "error"

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }
  async function saveGeneral(e) {
    e.preventDefault();
    setSaveStatus("saving");
    try {
      await onSave(form);
      setSaveStatus("saved");
    } catch (err) {
      console.error(err);
      setSaveStatus("error");
    }
    setTimeout(() => setSaveStatus(null), 2500);
  }
  function addCategory() {
    const c = newCategory.trim();
    if (!c || form.categories.some((x) => x.toLowerCase() === c.toLowerCase()))
      return;
    set("categories", [...form.categories, c]);
    setNewCategory("");
  }
  function removeCategory(c) {
    set(
      "categories",
      form.categories.filter((x) => x !== c),
    );
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 18,
        }}
      >
        <div
          className="stx-display"
          style={{ fontSize: "1.4rem", fontWeight: 700 }}
        >
          Settings
        </div>
      </div>

      <form
        onSubmit={saveGeneral}
        className="stx-card px-5 py-5"
        style={{ display: "flex", flexDirection: "column", gap: 14 }}
      >
        <div className="stx-label">Store identity</div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 200px" }}>
            <label className="stx-label">Store name</label>
            <input
              className="stx-input"
              style={{ marginTop: 4 }}
              value={form.storeName}
              onChange={(e) => set("storeName", e.target.value)}
              placeholder="e.g. Al-Karam General Store"
            />
          </div>
          <div style={{ flex: "1 1 200px" }}>
            <label className="stx-label">Tagline</label>
            <input
              className="stx-input"
              style={{ marginTop: 4 }}
              value={form.tagline}
              onChange={(e) => set("tagline", e.target.value)}
              placeholder="A short line under your name"
            />
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 140px" }}>
            <label className="stx-label">Logo letter</label>
            <input
              className="stx-input"
              style={{ marginTop: 4 }}
              maxLength={2}
              value={form.logoInitial}
              onChange={(e) => set("logoInitial", e.target.value)}
              placeholder="Auto from store name"
            />
          </div>
          <div style={{ flex: "1 1 140px" }}>
            <label className="stx-label">Currency symbol</label>
            <input
              className="stx-input"
              style={{ marginTop: 4 }}
              value={form.currencySymbol}
              onChange={(e) => set("currencySymbol", e.target.value)}
            />
          </div>
          <div style={{ flex: "1 1 140px" }}>
            <label className="stx-label">Shipping fee</label>
            <input
              type="number"
              min="0"
              className="stx-input"
              style={{ marginTop: 4 }}
              value={form.shippingFee}
              onChange={(e) => set("shippingFee", e.target.value)}
            />
          </div>
        </div>

        <div className="stx-label" style={{ marginTop: 6 }}>
          Contact
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 200px" }}>
            <label className="stx-label">Phone number</label>
            <input
              className="stx-input"
              style={{ marginTop: 4 }}
              value={form.contactPhone}
              onChange={(e) => set("contactPhone", e.target.value)}
              placeholder="03xx-xxxxxxx"
            />
          </div>
          <div style={{ flex: "1 1 200px" }}>
            <label className="stx-label">WhatsApp number</label>
            <input
              className="stx-input"
              style={{ marginTop: 4 }}
              value={form.whatsapp}
              onChange={(e) => set("whatsapp", e.target.value)}
              placeholder="03xx-xxxxxxx"
            />
          </div>
        </div>
        <div>
          <label className="stx-label">About your store</label>
          <textarea
            className="stx-input"
            rows={3}
            style={{ marginTop: 4 }}
            value={form.aboutText}
            onChange={(e) => set("aboutText", e.target.value)}
          />
        </div>

        <div>
          <div className="stx-label" style={{ marginBottom: 8 }}>
            Categories
          </div>
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              marginBottom: 8,
            }}
          >
            {form.categories.map((c) => (
              <span
                key={c}
                className="stall-tag"
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                {c}
                <button
                  type="button"
                  onClick={() => removeCategory(c)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--brick)",
                    display: "flex",
                  }}
                >
                  <Icon name="close" size={13} />
                </button>
              </span>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              className="stx-input"
              placeholder="New category name"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              style={{ maxWidth: 220 }}
            />
            <button
              type="button"
              onClick={addCategory}
              className="stx-btn stx-btn-outline"
              style={{ padding: "0 14px" }}
            >
              Add
            </button>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            type="submit"
            disabled={saveStatus === "saving"}
            className="stx-btn stx-btn-primary px-5 py-2.5"
            style={{ width: "fit-content" }}
          >
            {saveStatus === "saving" ? "Saving…" : "Save changes"}
          </button>
          {saveStatus === "saved" && (
            <span
              style={{
                color: "var(--primary)",
                fontSize: ".85rem",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Icon name="check" size={16} /> Saved
            </span>
          )}
          {saveStatus === "error" && (
            <span
              style={{
                color: "var(--danger)",
                fontSize: ".85rem",
                fontWeight: 600,
              }}
            >
              Couldn't save — check your connection and try again.
            </span>
          )}
        </div>
      </form>

      <div className="stx-card px-5 py-5" style={{ marginTop: 20 }}>
        <div
          className="stx-label"
          style={{
            marginBottom: 10,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Icon name="account_balance_wallet" size={15} /> Online payment
          gateway
        </div>
        <p
          style={{
            fontSize: ".85rem",
            color: "var(--ink-soft)",
            marginBottom: 14,
          }}
        >
          Right now customers pay by cash on delivery or a phone-confirmed
          order. When you're ready to accept cards, JazzCash or EasyPaisa
          online, you'll need a merchant account with that provider first.
        </p>
        <span className="badge-soon">Coming soon</span>
      </div>
    </div>
  );
}
