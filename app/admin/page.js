"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/components/Providers";
import Icon from "@/components/Icon";
import StarRow from "@/components/StarRow";
import {
  formatMoney, compressImage, uid,
  settingsFromRow, settingsToRow, DEFAULT_SETTINGS,
  productFromRow, orderFromRow, reviewFromRow,
  ORDER_STATUSES, STATUS_COLOR,
} from "@/lib/format";

const ADMIN_TABS = [
  { key: "overview", label: "Overview", icon: "dashboard" },
  { key: "products", label: "Products", icon: "inventory_2" },
  { key: "orders", label: "Orders", icon: "list_alt" },
  { key: "customers", label: "Customers", icon: "group" },
  { key: "reviews", label: "Reviews", icon: "chat" },
  { key: "settings", label: "Settings", icon: "settings" },
];

export default function AdminPage() {
  const { supabase, currentUser, profile, isAdmin, authReady } = useStore();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [tab, setTab] = useState("overview");
  const [editingProduct, setEditingProduct] = useState(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (authReady && !currentUser) router.push("/auth");
  }, [authReady, currentUser, router]);

  useEffect(() => {
    if (!currentUser || !profile) return;
    if (!profile.isAdmin) { setLoading(false); return; }
    (async () => {
      const [{ data: s }, { data: p }, { data: o }, { data: r }] = await Promise.all([
        supabase.from("store_settings").select("*").eq("id", 1).single(),
        supabase.from("products").select("*").order("created_at", { ascending: false }),
        supabase.from("orders").select("*").order("created_at", { ascending: false }),
        supabase.from("reviews").select("*").order("created_at", { ascending: false }),
      ]);
      setSettings(s ? settingsFromRow(s) : DEFAULT_SETTINGS);
      setProducts((p || []).map(productFromRow));
      setOrders((o || []).map(orderFromRow));
      setReviews((r || []).map(reviewFromRow));
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, profile?.isAdmin]);

  async function updateSettings(patch) {
    const next = { ...settings, ...patch };
    setSettings(next);
    const { error } = await supabase.from("store_settings").update(settingsToRow(patch)).eq("id", 1);
    if (error) { console.error(error); throw error; }
  }
  async function upsertProduct(p) {
    if (p.id) {
      const { error } = await supabase.from("products").update({
        name: p.name, category: p.category, price: p.price, stock: p.stock,
        description: p.description, images: p.images, video_url: p.videoUrl,
      }).eq("id", p.id);
      if (error) { console.error(error); throw error; }
      setProducts((list) => list.map((x) => (x.id === p.id ? p : x)));
    } else {
      const { data, error } = await supabase.from("products").insert({
        name: p.name, category: p.category, price: p.price, stock: p.stock,
        description: p.description, images: p.images, video_url: p.videoUrl,
      }).select().single();
      if (error) { console.error(error); throw error; }
      setProducts((list) => [productFromRow(data), ...list]);
    }
  }
  async function deleteProduct(id) {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) { console.error(error); throw error; }
    setProducts((list) => list.filter((p) => p.id !== id));
  }
  async function updateOrderStatus(orderId, status) {
    const { error } = await supabase.from("orders").update({ status }).eq("id", orderId);
    if (error) { console.error(error); throw error; }
    setOrders((list) => list.map((o) => (o.id === orderId ? { ...o, status } : o)));
  }
  async function deleteReview(id) {
    const { error } = await supabase.from("reviews").delete().eq("id", id);
    if (error) { console.error(error); throw error; }
    setReviews((list) => list.filter((r) => r.id !== id));
  }
  async function uploadProductImage(blob) {
    const path = `products/${uid("img_")}.jpg`;
    const { error } = await supabase.storage.from("product-images").upload(path, blob, { contentType: "image/jpeg" });
    if (error) throw error;
    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    return data.publicUrl;
  }

  if (!authReady || loading) {
    return <div className="stx-root flex items-center justify-center" style={{ minHeight: "100vh" }}><div className="stx-display" style={{ fontSize: "1.2rem" }}>Loading admin panel…</div></div>;
  }

  if (!profile?.isAdmin) {
    return (
      <div className="stx-root flex items-center justify-center" style={{ minHeight: "100vh" }}>
        <div className="stx-card px-6 py-6 text-center" style={{ maxWidth: 420 }}>
          <Icon name="lock" size={28} color="var(--ink-soft)" />
          <p style={{ color: "var(--ink-soft)", marginTop: 10 }}>Your account doesn't have admin access.</p>
          <button onClick={() => router.push("/")} className="stx-btn stx-btn-primary px-5 py-2.5 mt-4">Back to store</button>
        </div>
      </div>
    );
  }

  const revenue = orders.filter((o) => o.status !== "Cancelled").reduce((s, o) => s + o.total, 0);
  const pending = orders.filter((o) => o.status === "Pending").length;
  const lowStock = products.filter((p) => Number(p.stock) <= 5);
  const customersMap = new Map();
  orders.forEach((o) => { if (o.customerId && !customersMap.has(o.customerId)) customersMap.set(o.customerId, { name: o.customer.name, phone: o.customer.phone }); });
  const customers = Array.from(customersMap.entries()).map(([id, c]) => ({ id, ...c, orderCount: orders.filter((o) => o.customerId === id).length }));

  return (
    <div className="stx-root" style={{ display: "flex", minHeight: "100vh" }}>
      <nav style={{ width: 220, flexShrink: 0, background: "var(--ink)", color: "#fff", padding: "20px 14px", display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh" }} className={`admin-nav${mobileNavOpen ? " open" : ""}`}>
        <div className="stx-display" style={{ fontWeight: 700, fontSize: "1.05rem", marginBottom: 2 }}>{settings.storeName || "Your Store"}</div>
        <div style={{ fontSize: ".72rem", opacity: 0.6, marginBottom: 22 }}>Admin panel</div>
        {ADMIN_TABS.map((t) => (
          <button key={t.key} onClick={() => { setTab(t.key); setMobileNavOpen(false); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, border: "none", background: tab === t.key ? "rgba(255,255,255,.12)" : "transparent", color: "#fff", cursor: "pointer", fontWeight: tab === t.key ? 700 : 500, fontSize: ".88rem", marginBottom: 2, textAlign: "left" }}>
            <Icon name={t.icon} size={17} /> {t.label}
          </button>
        ))}
        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 8, paddingTop: 20 }}>
          <button onClick={() => router.push("/")} style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,.08)", border: "none", color: "#fff", padding: "9px 12px", borderRadius: 8, cursor: "pointer", fontSize: ".82rem" }}><Icon name="home" size={16} /> View store</button>
        </div>
      </nav>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="admin-topbar" style={{ alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid var(--line)", background: "var(--cream)" }}>
          <button onClick={() => setMobileNavOpen((v) => !v)} style={{ background: "none", border: "none" }}><Icon name="menu" size={22} /></button>
          <span style={{ fontWeight: 700 }}>{ADMIN_TABS.find((t) => t.key === tab)?.label}</span>
          <span style={{ width: 20 }} />
        </div>

        <div style={{ padding: 24, maxWidth: 1040 }}>
          {tab === "overview" && (
            <div>
              <div className="stx-display" style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: 18 }}>Overview</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14, marginBottom: 26 }}>
                <StatCard icon="inventory_2" label="Products" value={products.length} />
                <StatCard icon="list_alt" label="Total orders" value={orders.length} />
                <StatCard icon="fact_check" label="Pending orders" value={pending} accent={pending > 0} />
                <StatCard icon="account_balance_wallet" label="Revenue" value={formatMoney(revenue, settings.currencySymbol)} />
              </div>
              {lowStock.length > 0 && (
                <div className="stx-card px-5 py-4 mb-6" style={{ borderColor: "var(--brick)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, marginBottom: 8 }}><Icon name="warning" size={17} color="var(--brick)" /> Low stock</div>
                  {lowStock.map((p) => (<div key={p.id} style={{ display: "flex", justifyContent: "space-between", fontSize: ".85rem", padding: "4px 0" }}><span>{p.name}</span><span className="stx-mono">{p.stock} left</span></div>))}
                </div>
              )}
              <div className="stx-card px-5 py-4">
                <div style={{ fontWeight: 700, marginBottom: 10 }}>Recent orders</div>
                {orders.slice(0, 5).length === 0 ? (<p style={{ color: "var(--ink-soft)", fontSize: ".85rem" }}>No orders yet.</p>) : orders.slice(0, 5).map((o) => (
                  <div key={o.id} style={{ display: "flex", justifyContent: "space-between", fontSize: ".85rem", padding: "6px 0", borderTop: "1px solid var(--line)" }}><span className="stx-mono">{o.id}</span><span>{o.customer.name}</span><span className="stx-mono">{formatMoney(o.total, settings.currencySymbol)}</span></div>
                ))}
              </div>
            </div>
          )}

          {tab === "products" && (<ProductsTab products={products} settings={settings} onAdd={() => setEditingProduct({})} onEdit={(p) => setEditingProduct(p)} onDelete={deleteProduct} />)}
          {tab === "orders" && (<OrdersTab orders={orders} settings={settings} onUpdateStatus={updateOrderStatus} />)}
          {tab === "customers" && (<CustomersTab customers={customers} />)}
          {tab === "reviews" && (<ReviewsTab reviews={reviews} products={products} onDelete={deleteReview} />)}
          {tab === "settings" && (<SettingsTab settings={settings} onSave={updateSettings} />)}
        </div>
      </div>

      {editingProduct !== null && (
        <ProductForm
          product={editingProduct}
          categories={settings.categories || []}
          onCancel={() => setEditingProduct(null)}
          onSave={async (p) => { await upsertProduct(p); setEditingProduct(null); }}
          onUploadImage={uploadProductImage}
        />
      )}
    </div>
  );
}

function StatCard({ icon, label, value, accent }) {
  return (
    <div className="stx-card px-4 py-4">
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: accent ? "var(--brick)" : "var(--ink-soft)" }}>
        <Icon name={icon} size={17} />
        <span className="stx-label" style={{ color: "inherit" }}>{label}</span>
      </div>
      <div className="stx-mono" style={{ fontSize: "1.5rem", fontWeight: 700, marginTop: 8 }}>{value}</div>
    </div>
  );
}

/* ---------------------------------------------------------------------
   PRODUCTS TAB + FORM
--------------------------------------------------------------------- */
function ProductsTab({ products, settings, onAdd, onEdit, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(null);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div className="stx-display" style={{ fontSize: "1.4rem", fontWeight: 700 }}>Products</div>
        <button onClick={onAdd} className="stx-btn stx-btn-primary px-4 py-2 flex items-center gap-2" style={{ display: "flex" }}><Icon name="add_circle" size={17} color="#fff" /> Add product</button>
      </div>
      {products.length === 0 ? (
        <div className="stx-card px-6 py-12 text-center"><Icon name="inventory_2" size={28} color="var(--ink-soft)" /><p style={{ color: "var(--ink-soft)", marginTop: 10 }}>No products yet. Add your first one to open the store.</p></div>
      ) : (
        <div className="stx-card" style={{ overflow: "hidden" }}>
          {products.map((p, i) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderTop: i ? "1px solid var(--line)" : "none", flexWrap: "wrap" }}>
              <div style={{ width: 44, height: 44, borderRadius: 8, overflow: "hidden", background: "#EFEBDD", flexShrink: 0 }}>
                {p.images?.[0] && <img src={p.images[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
              </div>
              <div style={{ flex: 1, minWidth: 120 }}>
                <div style={{ fontWeight: 600, fontSize: ".88rem" }}>{p.name}</div>
                <div style={{ fontSize: ".76rem", color: "var(--ink-soft)" }}>{p.category || "Uncategorised"}</div>
              </div>
              <div className="stx-mono" style={{ fontSize: ".85rem", minWidth: 80 }}>{formatMoney(p.price, settings.currencySymbol)}</div>
              <div style={{ fontSize: ".8rem", color: Number(p.stock) <= 5 ? "var(--brick)" : "var(--ink-soft)", minWidth: 70 }}>{p.stock} in stock</div>
              <button onClick={() => onEdit(p)} className="stx-btn stx-btn-outline" style={{ padding: "6px 10px", fontSize: ".78rem", display: "flex", alignItems: "center", gap: 4 }}><Icon name="edit" size={14} /> Edit</button>
              {confirmDelete === p.id ? (
                <div style={{ display: "flex", gap: 4 }}>
                  <button onClick={() => { onDelete(p.id); setConfirmDelete(null); }} className="stx-btn" style={{ background: "var(--danger)", color: "#fff", padding: "6px 10px", fontSize: ".78rem" }}>Confirm</button>
                  <button onClick={() => setConfirmDelete(null)} className="stx-btn stx-btn-outline" style={{ padding: "6px 10px", fontSize: ".78rem" }}>Cancel</button>
                </div>
              ) : (
                <button onClick={() => setConfirmDelete(p.id)} style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer" }}><Icon name="delete" size={17} /></button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProductForm({ product, categories, onCancel, onSave, onUploadImage }) {
  const isNew = !product.id;
  const [form, setForm] = useState({
    id: product.id || null, name: product.name || "", category: product.category || categories[0] || "",
    price: product.price ?? "", stock: product.stock ?? "", description: product.description || "",
    images: product.images || [], videoUrl: product.videoUrl || "",
  });
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileRef = useRef(null);

  async function handleFiles(e) {
    const files = Array.from(e.target.files || []).slice(0, 5 - form.images.length);
    if (!files.length) return;
    setUploading(true); setUploadError("");
    try {
      const urls = [];
      for (const file of files) {
        const blob = await compressImage(file);
        const url = await onUploadImage(blob);
        urls.push(url);
      }
      setForm((f) => ({ ...f, images: [...f.images, ...urls] }));
    } catch (err) {
      console.error(err);
      setUploadError("Upload failed — check that the 'product-images' storage bucket exists and is public.");
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }
  function removeImage(i) { setForm((f) => ({ ...f, images: f.images.filter((_, idx) => idx !== i) })); }

  const canSave = form.name.trim() && form.price !== "" && form.stock !== "";
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  async function save(e) {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true); setSaveError("");
    try {
      await onSave({ ...form, price: Number(form.price), stock: Number(form.stock) });
    } catch (err) {
      console.error(err);
      setSaveError("Couldn't save this product — check your connection and try again.");
      setSaving(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(20,35,31,.5)", display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "40px 16px", zIndex: 200 }}>
      <form onSubmit={save} className="stx-card" style={{ width: "min(560px,100%)", padding: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid var(--line)" }}>
          <div className="stx-display" style={{ fontWeight: 700, fontSize: "1.1rem" }}>{isNew ? "Add product" : "Edit product"}</div>
          <button type="button" onClick={onCancel} style={{ background: "none", border: "none", cursor: "pointer" }}><Icon name="close" size={22} /></button>
        </div>

        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14, maxHeight: "70vh", overflowY: "auto" }}>
          <div><label className="stx-label">Product name</label><input className="stx-input" style={{ marginTop: 4 }} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}><label className="stx-label">Price</label><input type="number" min="0" className="stx-input" style={{ marginTop: 4 }} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required /></div>
            <div style={{ flex: 1 }}><label className="stx-label">Stock quantity</label><input type="number" min="0" className="stx-input" style={{ marginTop: 4 }} value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} required /></div>
          </div>
          <div>
            <label className="stx-label">Category</label>
            <select className="stx-input" style={{ marginTop: 4 }} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {categories.length === 0 && <option value="">No categories yet</option>}
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <div style={{ fontSize: ".72rem", color: "var(--ink-soft)", marginTop: 4 }}>Need a new category? Add it first from Settings → Categories.</div>
          </div>
          <div><label className="stx-label">Description</label><textarea className="stx-input" rows={4} style={{ marginTop: 4 }} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div>
            <label className="stx-label">Photos (up to 5)</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
              {form.images.map((img, i) => (
                <div key={i} style={{ position: "relative", width: 64, height: 64, borderRadius: 8, overflow: "hidden" }}>
                  <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <button type="button" onClick={() => removeImage(i)} style={{ position: "absolute", top: 2, right: 2, background: "rgba(0,0,0,.6)", border: "none", borderRadius: "50%", width: 18, height: 18, color: "#fff", cursor: "pointer", fontSize: 10 }}>✕</button>
                </div>
              ))}
              {form.images.length < 5 && (
                <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} style={{ width: 64, height: 64, borderRadius: 8, border: "1.5px dashed var(--line)", background: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--ink-soft)" }}>
                  <Icon name="upload" size={19} />
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleFiles} style={{ display: "none" }} />
            {uploading && <div style={{ fontSize: ".75rem", color: "var(--ink-soft)", marginTop: 4 }}>Uploading…</div>}
            {uploadError && <div style={{ fontSize: ".75rem", color: "var(--danger)", marginTop: 4 }}>{uploadError}</div>}
          </div>
          <div>
            <label className="stx-label">Video link (optional)</label>
            <input className="stx-input" style={{ marginTop: 4 }} placeholder="YouTube link, or a direct .mp4 URL" value={form.videoUrl} onChange={(e) => setForm({ ...form, videoUrl: e.target.value })} />
            <div style={{ fontSize: ".72rem", color: "var(--ink-soft)", marginTop: 4 }}>Upload your video to YouTube (unlisted is fine), then paste the link here.</div>
          </div>
        </div>

        {saveError && <div style={{ padding: "0 20px", color: "var(--danger)", fontSize: ".82rem" }}>{saveError}</div>}
        <div style={{ display: "flex", gap: 10, padding: 20, borderTop: "1px solid var(--line)" }}>
          <button type="button" onClick={onCancel} className="stx-btn stx-btn-outline" style={{ flex: 1, padding: "10px 0" }}>Cancel</button>
          <button type="submit" disabled={!canSave || saving} className="stx-btn stx-btn-primary" style={{ flex: 1, padding: "10px 0" }}>{saving ? "Saving…" : "Save product"}</button>
        </div>
      </form>
    </div>
  );
}

/* ---------------------------------------------------------------------
   ORDERS TAB
--------------------------------------------------------------------- */
function OrdersTab({ orders, settings, onUpdateStatus }) {
  const [expanded, setExpanded] = useState(null);
  return (
    <div>
      <div className="stx-display" style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: 18 }}>Orders</div>
      {orders.length === 0 ? (
        <div className="stx-card px-6 py-12 text-center"><Icon name="list_alt" size={28} color="var(--ink-soft)" /><p style={{ color: "var(--ink-soft)", marginTop: 10 }}>No orders yet.</p></div>
      ) : (
        <div className="stx-card" style={{ overflow: "hidden" }}>
          {orders.map((o, i) => (
            <div key={o.id} style={{ borderTop: i ? "1px solid var(--line)" : "none" }}>
              <button onClick={() => setExpanded(expanded === o.id ? null : o.id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", background: "none", border: "none", cursor: "pointer", textAlign: "left", flexWrap: "wrap" }}>
                <span className="stx-mono" style={{ fontSize: ".82rem", minWidth: 110 }}>{o.id}</span>
                <span style={{ flex: 1, fontSize: ".85rem", fontWeight: 600 }}>{o.customer.name}</span>
                <span style={{ fontSize: ".78rem", color: "var(--ink-soft)" }}>{new Date(o.createdAt).toLocaleDateString()}</span>
                <span className="stx-mono" style={{ fontSize: ".85rem", minWidth: 80, textAlign: "right" }}>{formatMoney(o.total, settings.currencySymbol)}</span>
                <span style={{ fontSize: ".75rem", fontWeight: 700, color: STATUS_COLOR[o.status], minWidth: 80, textAlign: "right" }}>{o.status}</span>
              </button>
              {expanded === o.id && (
                <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", gap: 24, flexWrap: "wrap", fontSize: ".85rem" }}>
                    <div><Icon name="call" size={13} style={{ verticalAlign: "middle", marginRight: 4 }} />{o.customer.phone}</div>
                    <div><Icon name="location_on" size={13} style={{ verticalAlign: "middle", marginRight: 4 }} />{o.customer.address}, {o.customer.city}</div>
                  </div>
                  {o.customer.notes && <div style={{ fontSize: ".82rem", color: "var(--ink-soft)" }}>Note: {o.customer.notes}</div>}
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {o.items.map((it) => (<div key={it.productId} style={{ display: "flex", justifyContent: "space-between", fontSize: ".82rem" }}><span>{it.name} × {it.qty}</span><span className="stx-mono">{formatMoney(it.price * it.qty, settings.currencySymbol)}</span></div>))}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                    <span className="stx-label">Status</span>
                    <select value={o.status} onChange={(e) => onUpdateStatus(o.id, e.target.value)} className="stx-input" style={{ width: "auto" }}>
                      {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
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
      <div className="stx-display" style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: 6 }}>Customers</div>
      <p style={{ fontSize: ".82rem", color: "var(--ink-soft)", marginBottom: 18 }}>Everyone who has placed at least one order while signed in. If someone forgets their password, they can reset it themselves from the sign-in screen — it emails them a link.</p>
      {customers.length === 0 ? (
        <div className="stx-card px-6 py-12 text-center"><Icon name="group" size={26} color="var(--ink-soft)" /><p style={{ color: "var(--ink-soft)", marginTop: 10 }}>No signed-in customers yet.</p></div>
      ) : (
        <div className="stx-card" style={{ overflow: "hidden" }}>
          {customers.map((c, i) => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", borderTop: i ? "1px solid var(--line)" : "none" }}>
              <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: ".88rem" }}>{c.name}</div><div style={{ fontSize: ".78rem", color: "var(--ink-soft)" }}>{c.phone}</div></div>
              <span className="stx-mono" style={{ fontSize: ".8rem", color: "var(--ink-soft)" }}>{c.orderCount} order{c.orderCount === 1 ? "" : "s"}</span>
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
function ReviewsTab({ reviews, products, onDelete }) {
  return (
    <div>
      <div className="stx-display" style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: 18 }}>Reviews</div>
      {reviews.length === 0 ? (
        <div className="stx-card px-6 py-12 text-center"><Icon name="chat" size={28} color="var(--ink-soft)" /><p style={{ color: "var(--ink-soft)", marginTop: 10 }}>No reviews yet.</p></div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {reviews.map((r) => {
            const product = products.find((p) => p.id === r.productId);
            return (
              <div key={r.id} className="stx-card px-4 py-3" style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontWeight: 600, fontSize: ".88rem" }}>{r.name}</span><StarRow value={r.rating} size={12} /></div>
                  <div style={{ fontSize: ".76rem", color: "var(--ink-soft)", marginTop: 2 }}>on {product ? product.name : "a deleted product"}</div>
                  <p style={{ fontSize: ".84rem", marginTop: 6 }}>{r.comment}</p>
                </div>
                <button onClick={() => onDelete(r.id)} style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer" }}><Icon name="delete" size={16} /></button>
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

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }
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
    if (!c || form.categories.includes(c)) return;
    set("categories", [...form.categories, c]);
    setNewCategory("");
  }
  function removeCategory(c) { set("categories", form.categories.filter((x) => x !== c)); }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div className="stx-display" style={{ fontSize: "1.4rem", fontWeight: 700 }}>Settings</div>
      </div>

      <form onSubmit={saveGeneral} className="stx-card px-5 py-5" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="stx-label">Store identity</div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 200px" }}><label className="stx-label">Store name</label><input className="stx-input" style={{ marginTop: 4 }} value={form.storeName} onChange={(e) => set("storeName", e.target.value)} placeholder="e.g. Al-Karam General Store" /></div>
          <div style={{ flex: "1 1 200px" }}><label className="stx-label">Tagline</label><input className="stx-input" style={{ marginTop: 4 }} value={form.tagline} onChange={(e) => set("tagline", e.target.value)} placeholder="A short line under your name" /></div>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 140px" }}><label className="stx-label">Logo letter</label><input className="stx-input" style={{ marginTop: 4 }} maxLength={2} value={form.logoInitial} onChange={(e) => set("logoInitial", e.target.value)} placeholder="Auto from store name" /></div>
          <div style={{ flex: "1 1 140px" }}><label className="stx-label">Currency symbol</label><input className="stx-input" style={{ marginTop: 4 }} value={form.currencySymbol} onChange={(e) => set("currencySymbol", e.target.value)} /></div>
          <div style={{ flex: "1 1 140px" }}><label className="stx-label">Shipping fee</label><input type="number" min="0" className="stx-input" style={{ marginTop: 4 }} value={form.shippingFee} onChange={(e) => set("shippingFee", e.target.value)} /></div>
        </div>

        <div className="stx-label" style={{ marginTop: 6 }}>Contact</div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 200px" }}><label className="stx-label">Phone number</label><input className="stx-input" style={{ marginTop: 4 }} value={form.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} placeholder="03xx-xxxxxxx" /></div>
          <div style={{ flex: "1 1 200px" }}><label className="stx-label">WhatsApp number</label><input className="stx-input" style={{ marginTop: 4 }} value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="03xx-xxxxxxx" /></div>
        </div>
        <div><label className="stx-label">About your store</label><textarea className="stx-input" rows={3} style={{ marginTop: 4 }} value={form.aboutText} onChange={(e) => set("aboutText", e.target.value)} /></div>

        <div>
          <div className="stx-label" style={{ marginBottom: 8 }}>Categories (stalls)</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            {form.categories.map((c) => (
              <span key={c} className="stall-tag" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>{c}<button type="button" onClick={() => removeCategory(c)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--brick)", display: "flex" }}><Icon name="close" size={13} /></button></span>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <input className="stx-input" placeholder="New category name" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} style={{ maxWidth: 220 }} />
            <button type="button" onClick={addCategory} className="stx-btn stx-btn-outline" style={{ padding: "0 14px" }}>Add</button>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button type="submit" disabled={saveStatus === "saving"} className="stx-btn stx-btn-primary px-5 py-2.5" style={{ width: "fit-content" }}>
            {saveStatus === "saving" ? "Saving…" : "Save changes"}
          </button>
          {saveStatus === "saved" && <span style={{ color: "var(--primary)", fontSize: ".85rem", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}><Icon name="check" size={16} /> Saved</span>}
          {saveStatus === "error" && <span style={{ color: "var(--danger)", fontSize: ".85rem", fontWeight: 600 }}>Couldn't save — check your connection and try again.</span>}
        </div>
      </form>

      <div className="stx-card px-5 py-5" style={{ marginTop: 20 }}>
        <div className="stx-label" style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}><Icon name="account_balance_wallet" size={15} /> Online payment gateway</div>
        <p style={{ fontSize: ".85rem", color: "var(--ink-soft)", marginBottom: 14 }}>
          Right now customers pay by cash on delivery or a phone-confirmed order. When you're ready to accept cards,
          JazzCash or EasyPaisa online, you'll need a merchant account with that provider first.
        </p>
        <span className="badge-soon">Coming soon</span>
      </div>
    </div>
  );
}
