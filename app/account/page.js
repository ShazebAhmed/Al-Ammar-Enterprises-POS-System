"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore } from "@/components/Providers";
import Icon from "@/components/Icon";
import {
  formatMoney,
  orderFromRow,
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
                  key={it.productId}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: ".82rem",
                    color: "var(--ink-soft)",
                    padding: "2px 0",
                  }}
                >
                  <span>
                    {it.name} × {it.qty}
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
                  {new Date(o.createdAt).toLocaleDateString()}
                </span>
                <span className="stx-mono">
                  {formatMoney(o.total, settings.currencySymbol)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
