"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

const StoreContext = createContext(null);
export function useStore() {
  return useContext(StoreContext);
}

function mergeCarts(a, b) {
  const merged = [...a];
  for (const line of b) {
    const existing = merged.find((l) => l.productId === line.productId);
    if (existing) existing.qty += line.qty;
    else merged.push({ ...line });
  }
  return merged;
}

export default function Providers({ children }) {
  const [supabase] = useState(() => createClient());
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [cart, setCart] = useState([]); // [{productId, qty}]
  const [authReady, setAuthReady] = useState(false);

  const currentUser = session?.user || null;
  const isAdmin = !!profile?.isAdmin;

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      if (event === "PASSWORD_RECOVERY" && typeof window !== "undefined") {
        window.location.href = "/reset-password";
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      if (!currentUser) { setProfile(null); return; }
      try {
        const { data, error } = await supabase.from("profiles").select("*").eq("id", currentUser.id).single();
        if (error) throw error;
        setProfile({ id: data.id, name: data.name, phone: data.phone, isAdmin: data.is_admin });

        const { data: cartRows } = await supabase.from("cart_items").select("*").eq("customer_id", currentUser.id);
        const saved = (cartRows || []).map((r) => ({ productId: r.product_id, qty: r.qty }));
        setCart((guestCart) => mergeCarts(saved, guestCart));
      } catch (e) {
        console.error("Couldn't load profile/cart", e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  function addToCart(productId, qty = 1) {
    const existing = cart.find((i) => i.productId === productId);
    const nextQty = existing ? existing.qty + qty : qty;
    const next = existing
      ? cart.map((i) => (i.productId === productId ? { ...i, qty: nextQty } : i))
      : [...cart, { productId, qty }];
    setCart(next);
    if (currentUser) {
      supabase.from("cart_items").upsert({ customer_id: currentUser.id, product_id: productId, qty: nextQty, updated_at: new Date().toISOString() }).then(() => {});
    }
  }
  function setCartQty(productId, qty) {
    if (qty <= 0) return removeFromCart(productId);
    setCart((c) => c.map((i) => (i.productId === productId ? { ...i, qty } : i)));
    if (currentUser) supabase.from("cart_items").upsert({ customer_id: currentUser.id, product_id: productId, qty, updated_at: new Date().toISOString() }).then(() => {});
  }
  function removeFromCart(productId) {
    setCart((c) => c.filter((i) => i.productId !== productId));
    if (currentUser) supabase.from("cart_items").delete().eq("customer_id", currentUser.id).eq("product_id", productId).then(() => {});
  }
  function clearCart() {
    setCart([]);
    if (currentUser) supabase.from("cart_items").delete().eq("customer_id", currentUser.id).then(() => {});
  }

  async function logOut() {
    await supabase.auth.signOut();
    setCart([]);
  }

  const cartCount = cart.reduce((n, i) => n + i.qty, 0);

  const value = {
    supabase, session, profile, currentUser, isAdmin, authReady,
    cart, cartCount, addToCart, setCartQty, removeFromCart, clearCart, logOut,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
