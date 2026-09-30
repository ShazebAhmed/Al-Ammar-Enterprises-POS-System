"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore } from "@/components/Providers";
import Icon from "@/components/Icon";
import NotifyButton from "@/components/NotifyButton";
import { sendTestAlert, watchNewOrders } from "@/lib/push";
import DiscountsTab from "@/components/admin/DiscountsTab";
import StatCard from "@/components/admin/StatCard";
import ReportsTab from "@/components/admin/ReportsTab";
import { customersFromOrders } from "@/lib/customers";
import { inPeriod, makeCostOf, periodPrefix, summarize } from "@/lib/reports";
import ProductsTab from "@/components/admin/ProductsTab";
import ProductForm from "@/components/admin/ProductForm";
import OrdersTab from "@/components/admin/OrdersTab";
import CustomersTab from "@/components/admin/CustomersTab";
import ReviewsTab from "@/components/admin/ReviewsTab";
import SettingsTab from "@/components/admin/SettingsTab";
import { ADMIN_HOST, STORE_HOST } from "@/lib/hosts";
import {
  formatMoney,
  formatOrderTime,
  uid,
  settingsFromRow,
  settingsToRow,
  DEFAULT_SETTINGS,
  productFromRow,
  orderFromRow,
  reviewFromRow,
  STATUS_COLOR,
} from "@/lib/format";
const ADMIN_TABS = [
  { key: "overview", label: "Overview", icon: "dashboard" },
  { key: "products", label: "Products", icon: "inventory_2" },
  { key: "orders", label: "Orders", icon: "list_alt" },
  { key: "reports", label: "Reports", icon: "bar_chart" },
  { key: "customers", label: "Customers", icon: "group" },
  { key: "reviews", label: "Reviews", icon: "chat" },
  { key: "discounts", label: "Discounts", icon: "sell" },
  { key: "settings", label: "Settings", icon: "settings" },
];
const PERIODS = [
  { key: "today", label: "Today" },
  { key: "month", label: "This month" },
  { key: "year", label: "This year" },
  { key: "all", label: "All time" },
];
const DAY_MS = 24 * 60 * 60 * 1000;
// The open tab lives in the address (/admin?tab=products), so refreshing keeps
// it and Back returns to the previous tab. A new-order alert's ?order= link
// opens Orders.
function tabFromUrl() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("order")) return "orders";
  const key = params.get("tab");
  return ADMIN_TABS.some((t) => t.key === key) ? key : "overview";
}
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
    logOut,
  } = useStore();
  const router = useRouter();
  const [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState(""),
    [revision, setRevision] = useState(0);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS),
    [products, setProducts] = useState([]),
    // Cost prices (admin only): { productId: cost }, and costs saved with orders.
    [costs, setCosts] = useState({}),
    [orderCosts, setOrderCosts] = useState([]),
    [orders, setOrders] = useState([]),
    [reviews, setReviews] = useState([]),
    [tab, setTab] = useState("overview"),
    [editingProduct, setEditingProduct] = useState(null),
    [mobileNavOpen, setMobileNavOpen] = useState(false),
    [focusOrder, setFocusOrder] = useState(""),
    [testAlert, setTestAlert] = useState(""),
    [alertsOn, setAlertsOn] = useState(false),
    // Which period the overview's figures cover.
    [period, setPeriod] = useState("month"),
    // On the admin address "/" is the admin panel itself, so the storefront
    // links go to the shop's own address.
    [storeHref, setStoreHref] = useState("/");
  // A new-order alert opens /admin?order=AA-10003: show that order.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("order");
    if (id) setFocusOrder(id.slice(0, 64));
    setTab(tabFromUrl());
    if (window.location.host === ADMIN_HOST)
      setStoreHref(`https://${STORE_HOST}/`);
    const onPopState = () => setTab(tabFromUrl());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
  // Signing out sends the admin to the sign-in page via the effect below
  // (no current user). logOut shows its own error if it fails.
  async function signOut() {
    setMobileNavOpen(false);
    await logOut().catch(() => {});
  }
  function openTab(key) {
    setTab(key);
    const url = key === "overview" ? "/admin" : `/admin?tab=${key}`;
    if (window.location.pathname + window.location.search !== url)
      window.history.pushState(null, "", url);
  }
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
    // Costs for profit reports; the shop still works if they cannot be read.
    async function costRows() {
      try {
        const orderCostRows = async () => {
          const all = [];
          for (let offset = 0; ; offset += 1000) {
            const { data, error } = await supabase
              .from("order_item_costs")
              .select("order_id,product_id,unit_cost")
              .order("order_id")
              .order("product_id")
              .range(offset, offset + 999);
            if (error) throw error;
            all.push(...data);
            if (data.length < 1000) return all;
          }
        };
        const [pc, oc] = await Promise.all([
          supabase.from("product_costs").select("product_id,cost"),
          orderCostRows(),
        ]);
        if (pc.error) throw pc.error;
        return {
          costs: Object.fromEntries(
            pc.data.map((r) => [r.product_id, Number(r.cost)]),
          ),
          orderCosts: oc,
        };
      } catch {
        return { costs: {}, orderCosts: [] };
      }
    }
    (async () => {
      try {
        const [s, p, o, r, c] = await Promise.all([
          supabase.from("store_settings").select("*").eq("id", 1).maybeSingle(),
          allRows("products"),
          allRows("orders"),
          allRows("reviews"),
          costRows(),
        ]);
        if (s.error) throw s.error;
        if (!alive) return;
        setSettings(s.data ? settingsFromRow(s.data) : DEFAULT_SETTINGS);
        setProducts(p.map(productFromRow));
        setOrders(o.map(orderFromRow));
        setReviews(r.map(reviewFromRow));
        setCosts(c.costs);
        setOrderCosts(c.orderCosts);
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
        freeDeliveryOver: Number(patch.freeDeliveryOver) || 0,
      });
      if (!Number.isFinite(row.shipping_fee) || row.shipping_fee < 0)
        throw new Error("Invalid delivery fee");
      if (
        !Number.isFinite(row.free_delivery_over) ||
        row.free_delivery_over < 0
      )
        throw new Error("Invalid free delivery amount");
      const { error } = await supabase
        .from("store_settings")
        .upsert({ id: 1, ...row });
      if (error) throw error;
      setSettings({
        ...settings,
        ...patch,
        shippingFee: Number(patch.shippingFee),
        freeDeliveryOver: Number(patch.freeDeliveryOver) || 0,
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
        compare_at_price: p.compareAtPrice > p.price ? p.compareAtPrice : null,
        stock: p.stock,
        option_label: p.optionLabel || "",
        variants: p.variants || [],
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
      // The cost price is kept in its own admin-only table.
      if (p.cost !== undefined) {
        const cost = p.cost === null ? null : Number(p.cost);
        const res =
          cost === null
            ? await supabase
                .from("product_costs")
                .delete()
                .eq("product_id", saved.id)
            : await supabase.from("product_costs").upsert({
                product_id: saved.id,
                cost,
                updated_at: new Date().toISOString(),
              });
        if (res.error) throw res.error;
        setCosts((all) => {
          const next = { ...all };
          if (cost === null) delete next[saved.id];
          else next[saved.id] = cost;
          return next;
        });
      }
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
        {currentUser ? (
          // Signed in, but not as an administrator: offer a way out so another
          // account can sign in.
          <button className="stx-btn stx-btn-primary" onClick={signOut}>
            <Icon name="logout" size={16} /> Log out and switch account
          </button>
        ) : (
          <Link className="stx-btn stx-btn-primary" href="/auth?next=/admin">
            Go to sign in
          </Link>
        )}
      </main>
    );
  const pending = orders.filter((o) => o.status === "Pending").length;
  const prefix = periodPrefix(period);
  const costOf = makeCostOf(orderCosts, costs);
  const periodTotals = summarize(
    orders.filter((o) => inPeriod(o, prefix)),
    "",
    costOf,
  );
  const periodName = PERIODS.find((p) => p.key === period).label.toLowerCase();
  const lowStock = products
    .filter((p) => Number(p.stock) <= 5)
    .sort((a, b) => a.stock - b.stock);
  const customers = customersFromOrders(orders);
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
        <Link className="brand" href={storeHref}>
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
                openTab(t.key);
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
          <Link href={storeHref}>
            <Icon name="arrow_forward" size={16} /> Visit your storefront
          </Link>
          <button type="button" onClick={signOut}>
            <Icon name="logout" size={16} /> Log out
          </button>
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
                  {/* Once alerts are on, this shrinks to one quiet line. */}
                  <section
                    className={
                      alertsOn
                        ? "admin-alerts compact"
                        : "stx-card px-5 py-4 admin-alerts"
                    }
                  >
                    {!alertsOn && (
                      <div>
                        <strong>New order alerts</strong>
                        <p className="muted small" style={{ margin: 0 }}>
                          Get a notification on this phone for every new order.
                          Turn it on once on each phone you use.
                        </p>
                      </div>
                    )}
                    <div className="admin-alerts-actions">
                      <NotifyButton
                        label="Turn on alerts"
                        done="New order alerts are on for this phone."
                        enable={() => watchNewOrders(supabase)}
                        onState={(s) => setAlertsOn(s === "on")}
                      />
                      <button
                        type="button"
                        className={
                          alertsOn ? "text-button" : "stx-btn stx-btn-outline"
                        }
                        disabled={testAlert === "sending"}
                        onClick={async () => {
                          setTestAlert("sending");
                          try {
                            setTestAlert(
                              (await sendTestAlert(supabase)) ? "sent" : "off",
                            );
                          } catch {
                            setTestAlert("failed");
                          }
                        }}
                      >
                        Send test alert
                      </button>
                      {testAlert && testAlert !== "sending" && (
                        <p
                          className="muted small"
                          role="status"
                          style={{ margin: 0 }}
                        >
                          {testAlert === "sent"
                            ? "Sent. It should arrive on this phone in a few seconds."
                            : testAlert === "off"
                              ? "Alerts are not on for this phone yet. Tap Turn on alerts first."
                              : "Could not send. Please check your internet and try again."}
                        </p>
                      )}
                    </div>
                  </section>
                  <div
                    className="period-picker"
                    role="group"
                    aria-label="Figures for"
                  >
                    {PERIODS.map((p) => (
                      <button
                        key={p.key}
                        type="button"
                        aria-pressed={period === p.key}
                        onClick={() => setPeriod(p.key)}
                      >
                        {p.label}
                      </button>
                    ))}
                    <button type="button" onClick={() => openTab("reports")}>
                      Full report →
                    </button>
                  </div>
                  <div className="admin-stats">
                    <StatCard
                      icon="account_balance_wallet"
                      label="Delivered sales"
                      value={formatMoney(
                        periodTotals.sales,
                        settings.currencySymbol,
                      )}
                      caption={
                        periodTotals.cost > 0
                          ? `${periodName} · profit ${formatMoney(periodTotals.profit, settings.currencySymbol)}`
                          : `${periodName} · order value, not profit`
                      }
                      accent
                    />
                    <StatCard
                      icon="list_alt"
                      label="Orders"
                      value={periodTotals.orders}
                      caption={`${periodName} · ${periodTotals.cancelled} cancelled`}
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
                        <button onClick={() => openTab("products")}>
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
                      <button onClick={() => openTab("orders")}>
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
                  key={focusOrder}
                  focusOrder={focusOrder}
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
              {tab === "reports" && (
                <ReportsTab
                  orders={orders}
                  settings={settings}
                  costOf={costOf}
                />
              )}
              {tab === "customers" && (
                <CustomersTab customers={customers} settings={settings} />
              )}
              {tab === "reviews" && (
                <ReviewsTab
                  reviews={reviews}
                  products={products}
                  onDelete={(id) => deleteReview(id).catch(() => {})}
                  onApprove={(id) => approveReview(id).catch(() => {})}
                />
              )}
              {tab === "discounts" && (
                <DiscountsTab
                  supabase={supabase}
                  settings={settings}
                  notify={notify}
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
          product={{
            ...editingProduct,
            cost: editingProduct.id ? (costs[editingProduct.id] ?? "") : "",
          }}
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
