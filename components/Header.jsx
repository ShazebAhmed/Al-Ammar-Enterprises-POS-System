"use client";
import Link from "next/link";
import { useStore } from "./Providers";
import Icon from "./Icon";

export default function Header({ settings }) {
  const { cartCount, currentUser, profile, isAdmin } = useStore();

  return (
    <header style={{ borderBottom: "1px solid var(--line)", background: "var(--cream)", position: "sticky", top: 0, zIndex: 40 }}>
      <div style={{ maxWidth: 1120, margin: "0 auto" }} className="px-4 py-3 flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2">
          <div style={{ width: 38, height: 38, borderRadius: 8, background: "var(--primary)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }} className="stx-display">
            {(settings.logoInitial || settings.storeName || "S").trim().charAt(0).toUpperCase() || "S"}
          </div>
          <div style={{ textAlign: "left" }}>
            <div className="stx-display" style={{ fontSize: "1.15rem", lineHeight: 1, fontWeight: 700, color: "var(--ink)" }}>{settings.storeName || "Your Store"}</div>
            {settings.tagline && <div style={{ fontSize: ".68rem", color: "var(--ink-soft)" }}>{settings.tagline}</div>}
          </div>
        </Link>

        <div style={{ marginLeft: "auto" }} />

        <Link href={currentUser ? "/account" : "/auth"} title={currentUser ? "My account" : "Sign in"} style={{ color: "var(--ink-soft)", display: "flex", alignItems: "center", gap: 5, fontSize: ".82rem", fontWeight: 600 }}>
          <Icon name="person" size={19} />
          <span className="hide-narrow">{profile ? profile.name?.split(" ")[0] || "Account" : "Sign in"}</span>
        </Link>
        {isAdmin && (
          <Link href="/admin" title="Admin" style={{ color: "var(--ink-soft)", display: "flex" }}>
            <Icon name="settings" size={20} />
          </Link>
        )}
        <Link href="/cart" style={{ background: "var(--ink)", color: "#fff", borderRadius: 8, padding: "8px 12px", display: "flex", alignItems: "center", gap: 6 }}>
          <Icon name="shopping_cart" size={18} color="#fff" />
          <span style={{ fontSize: ".85rem", fontWeight: 600 }} className="stx-mono">{cartCount}</span>
        </Link>
      </div>
    </header>
  );
}
