"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStore } from "./Providers";
import Icon from "./Icon";
export default function Header({ settings }) {
  const { cartCount, currentUser, isAdmin, inStoreApp } = useStore();
  const path = usePathname();
  return (
    <>
      <div className="announcement">
        <span>THE EVERYDAY, ELEVATED.</span>
        <span>
          Cash on delivery <span className="announcement-dot">·</span> Order
          with confidence
        </span>
      </div>
      <header className="site-header">
        <div className="container header-inner">
          <Link
            href="/"
            className="brand"
            aria-label={`${settings.storeName || "Al-Ammar"} home`}
          >
            <span className="brand-mark">{settings.logoInitial || "A"}</span>
            <span>
              <strong>{settings.storeName || "Al-Ammar"}</strong>
              <small>THE EVERYDAY STORE</small>
            </span>
          </Link>
          <nav className="desktop-nav" aria-label="Main navigation">
            <Link href="/" aria-current={path === "/" ? "page" : undefined}>
              The collection
            </Link>
            <Link href="/#categories">Categories</Link>
            <Link href="/#about">Our story</Link>
          </nav>
          <div className="header-actions">
            {isAdmin && !inStoreApp && (
              <Link
                className="icon-button"
                href="/admin"
                aria-label="Open store dashboard"
              >
                <Icon name="dashboard" />
              </Link>
            )}
            <Link
              className="account-link"
              href="/track"
              aria-label="Track your order"
              aria-current={path === "/track" ? "page" : undefined}
            >
              <Icon name="local_shipping" size={21} />
              <span className="hide-narrow">Track order</span>
            </Link>
            <Link
              className="account-link"
              href={currentUser ? "/account" : "/auth"}
              aria-label={currentUser ? "My account" : "Sign in"}
            >
              <Icon name="person" size={21} />
              <span className="hide-narrow">
                {currentUser ? "My account" : "Sign in"}
              </span>
            </Link>
            <Link
              className="cart-link"
              href="/cart"
              aria-label={`Basket, ${cartCount} items`}
            >
              <Icon name="shopping_cart" size={20} />
              <span className="hide-narrow">Basket</span>
              <span className="cart-count">{cartCount}</span>
            </Link>
          </div>
        </div>
      </header>
    </>
  );
}
