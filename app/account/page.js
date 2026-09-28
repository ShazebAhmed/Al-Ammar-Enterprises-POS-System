"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore } from "@/components/Providers";
import Icon from "@/components/Icon";
import OrderReceipt from "@/components/OrderReceipt";
import NotifyButton from "@/components/NotifyButton";
import { followMyOrders } from "@/lib/push";
import {
  formatMoney,
  formatOrderTime,
  itemName,
  orderFromRow,
  printBill,
  settingsFromRow,
  DEFAULT_SETTINGS,
  STATUS_COLOR,
} from "@/lib/format";

export default function AccountPage() {
  const { supabase, currentUser, profile, authReady, profileReady, logOut } =
    useStore();
  const router = useRouter();
  const [orders, setOrders] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [billOrder, setBillOrder] = useState(null);

  // Render the chosen bill (hidden on screen), print it, then remove it.
  useEffect(() => {
    if (!billOrder) return;
    const done = () => setBillOrder(null);
    window.addEventListener("afterprint", done, { once: true });
    const frame = requestAnimationFrame(() => printBill(billOrder.id));
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("afterprint", done);
    };
  }, [billOrder]);

  useEffect(() => {
    if (authReady && !currentUser) router.push("/auth");
  }, [authReady, currentUser, router]);

  useEffect(() => {
    if (!currentUser || !supabase) return;
    let alive = true;
    setLoadingOrders(true);
    setLoadError("");
    (async () => {
      try {
        const [o, s] = await Promise.all([
          supabase
            .from("orders")
            .select("*")
            .eq("customer_id", currentUser.id)
            .order("created_at", { ascending: false }),
          supabase.from("store_settings").select("*").eq("id", 1).maybeSingle(),
        ]);
        if (o.error || s.error) throw o.error || s.error;
        if (alive) {
          setOrders((o.data || []).map(orderFromRow));
          setSettings(s.data ? settingsFromRow(s.data) : DEFAULT_SETTINGS);
        }
      } catch {
        if (alive)
          setLoadError(
            "Could not load your orders. Please refresh to try again.",
          );
      } finally {
        if (alive) setLoadingOrders(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [currentUser?.id, supabase]);

  async function handleLogOut() {
    try {
      await logOut();
      router.push("/");
    } catch {}
  }

  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  async function handleDeleteAccount() {
    if (
      !window.confirm(
        "Delete your account? Your sign-in, profile and saved basket are removed and cannot be recovered. Past orders stay in the store's records.",
      )
    )
      return;
    setDeleting(true);
    setDeleteError("");
    try {
      const { error } = await supabase.rpc("delete_my_account");
      if (error) throw error;
      await logOut().catch(() => {});
      router.push("/");
    } catch {
      setDeleteError(
        "Your account could not be deleted. Please try again, or message us and we will delete it for you.",
      );
      setDeleting(false);
    }
  }

  if (loadError || !supabase)
    return (
      <main className="page-wrap">
        <div className="inline-error" role="alert">
          {loadError || "Your account is temporarily unavailable."}
        </div>
      </main>
    );
  if (authReady && profileReady && currentUser && !profile)
    return (
      <main className="page-wrap">
        <p>Could not load your profile. Please sign in again.</p>
        <Link href="/auth">Sign in</Link>
      </main>
    );
  if (!currentUser || !profile || !settings) {
    return (
      <main style={{ maxWidth: 720, margin: "0 auto" }} className="px-4 py-6">
        <p style={{ color: "var(--ink-soft)" }}>Loading…</p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 720, margin: "0 auto" }} className="px-4 py-6">
      <Link
        href="/"
        style={{
          color: "var(--ink-soft)",
          display: "flex",
          alignItems: "center",
          gap: 4,
          marginBottom: 16,
          width: "fit-content",
        }}
      >
        <Icon name="chevron_left" size={18} /> Back to store
      </Link>

      <div
        className="stx-card px-5 py-5 mb-6"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <div
            className="stx-display"
            style={{ fontSize: "1.2rem", fontWeight: 700 }}
          >
            {profile.name || "Your account"}
          </div>
          <div style={{ fontSize: ".82rem", color: "var(--ink-soft)" }}>
            {profile.phone}
          </div>
        </div>
        <button
          onClick={handleLogOut}
          className="stx-btn stx-btn-outline px-4 py-2"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: ".85rem",
          }}
        >
          <Icon name="logout" size={16} /> Log out
        </button>
      </div>

      <div className="stx-label" style={{ marginBottom: 10 }}>
        Your orders
      </div>
      <NotifyButton
        className="mb-4"
        label="Get order updates on this phone"
        done="Done. This phone will be notified when your orders are confirmed, sent and delivered."
        enable={() => followMyOrders(supabase)}
      />
      {loadingOrders ? (
        <p style={{ color: "var(--ink-soft)" }}>Loading…</p>
      ) : orders.length === 0 ? (
        <div className="stx-card px-6 py-12 text-center">
          <Icon name="list_alt" size={26} color="var(--ink-soft)" />
          <p style={{ color: "var(--ink-soft)", marginTop: 10 }}>
            No orders yet — anything you buy while signed in will show up here.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {orders.map((o) => (
            <div key={o.id} className="stx-card px-4 py-4">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <span
                  className="stx-mono"
                  style={{ fontWeight: 700, fontSize: ".85rem" }}
                >
                  {o.id}
                </span>
                <span
                  style={{
                    fontSize: ".75rem",
                    fontWeight: 700,
                    color: STATUS_COLOR[o.status] || "var(--ink-soft)",
                  }}
                >
                  {o.status}
                </span>
              </div>
              {o.items.map((it) => (
                <div
                  key={`${it.productId}:${it.variant || ""}`}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: ".82rem",
                    color: "var(--ink-soft)",
                    padding: "2px 0",
                  }}
                >
                  <span>
                    {itemName(it.name, it.variant)} × {it.qty}
                  </span>
                  <span className="stx-mono">
                    {formatMoney(it.price * it.qty, settings.currencySymbol)}
                  </span>
                </div>
              ))}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontWeight: 700,
                  borderTop: "1px solid var(--line)",
                  marginTop: 8,
                  paddingTop: 8,
                }}
              >
                <span style={{ fontSize: ".85rem" }}>
                  {formatOrderTime(o.createdAt)}
                </span>
                <span className="stx-mono">
                  {formatMoney(o.total, settings.currencySymbol)}
                </span>
              </div>
              <button
                type="button"
                className="stx-btn stx-btn-outline no-print"
                style={{ marginTop: 10, fontSize: ".8rem" }}
                onClick={() => setBillOrder(o)}
              >
                <Icon name="download" size={15} /> Download bill
              </button>
            </div>
          ))}
        </div>
      )}
      {!profile.isAdmin && (
        <section
          className="stx-card px-5 py-5 no-print"
          style={{ marginTop: 32, borderColor: "var(--line)" }}
        >
          <div className="stx-label" style={{ marginBottom: 6 }}>
            Delete account
          </div>
          <p
            style={{
              color: "var(--ink-soft)",
              fontSize: ".9rem",
              margin: "0 0 12px",
            }}
          >
            Removes your sign-in, profile and saved basket. Past orders stay in
            our records for accounting.{" "}
            <Link href="/policies/delete-account">Learn more</Link>
          </p>
          {deleteError && (
            <div className="inline-error" role="alert">
              {deleteError}
            </div>
          )}
          <button
            type="button"
            onClick={handleDeleteAccount}
            disabled={deleting}
            className="stx-btn stx-btn-outline px-4 py-2"
            style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
          >
            <Icon name="delete" size={16} />{" "}
            {deleting ? "Deleting…" : "Delete my account"}
          </button>
        </section>
      )}
      {billOrder && settings && (
        <div className="receipt-print-only">
          <OrderReceipt order={billOrder} settings={settings} />
        </div>
      )}
    </main>
  );
}
