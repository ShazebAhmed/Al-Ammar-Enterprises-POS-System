"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase";
import { changeQuantity, mergeCarts, normalizeCart } from "@/lib/cart";
const StoreContext = createContext(null);
export const useStore = () => useContext(StoreContext);
const storageKey = (owner) => `al-ammar:cart:v2:${owner || "guest"}`;
function readCache(owner) {
  try {
    return JSON.parse(localStorage.getItem(storageKey(owner)) || "null");
  } catch {
    return null;
  }
}
function writeCache(owner, lines, dirty) {
  try {
    localStorage.setItem(storageKey(owner), JSON.stringify({ lines, dirty }));
  } catch {
    /* Storage can be unavailable in private browsing. */
  }
}
export default function Providers({ children }) {
  const [supabase] = useState(createClient);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [profileReady, setProfileReady] = useState(false);
  const [cartReady, setCartReady] = useState(false);
  const [cart, setCart] = useState([]);
  const [notice, setNotice] = useState(null);
  const [syncError, setSyncError] = useState("");
  const [cartLoadError, setCartLoadError] = useState("");
  const [loadRevision, setLoadRevision] = useState(0);
  const cartRef = useRef([]),
    ownerRef = useRef(null),
    queue = useRef(Promise.resolve()),
    toastTimer = useRef(null);
  const currentUser = session?.user || null;
  function notify(message, type = "success") {
    clearTimeout(toastTimer.current);
    setNotice({ message, type });
    toastTimer.current = setTimeout(() => setNotice(null), 4500);
  }
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  useEffect(() => {
    if (!supabase) {
      setAuthReady(true);
      return;
    }
    let alive = true;
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      if (!alive) return;
      setSession(next);
      setAuthReady(true);
      // Preserve recovery tokens/session. Replacing the entire page used to lose the recovery context.
      if (
        event === "PASSWORD_RECOVERY" &&
        window.location.pathname !== "/reset-password"
      )
        window.location.assign("/reset-password");
    });
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (alive) {
          setSession(data?.session || null);
          setAuthReady(true);
          if (error)
            notify(
              "Could not restore your session. Please sign in again.",
              "error",
            );
        }
      })
      .catch(() => {
        if (alive) setAuthReady(true);
      });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, [supabase]);
  function setLocal(lines, owner = ownerRef.current, dirty = true) {
    const clean = normalizeCart(lines);
    cartRef.current = clean;
    setCart(clean);
    writeCache(owner, clean, dirty);
    return clean;
  }
  function sync(lines, owner) {
    if (!owner || !supabase) return Promise.resolve();
    queue.current = queue.current
      .catch(() => {})
      .then(async () => {
        if (ownerRef.current !== owner) return;
        const existing = await supabase
          .from("cart_items")
          .select("product_id")
          .eq("customer_id", owner);
        if (existing.error) throw existing.error;
        if (lines.length) {
          const res = await supabase.from("cart_items").upsert(
            lines.map((l) => ({
              customer_id: owner,
              product_id: l.productId,
              qty: l.qty,
              updated_at: new Date().toISOString(),
            })),
            { onConflict: "customer_id,product_id" },
          );
          if (res.error) throw res.error;
        }
        const removed = (existing.data || [])
          .filter(
            (r) => !lines.some((l) => l.productId === String(r.product_id)),
          )
          .map((r) => r.product_id);
        if (removed.length) {
          const res = await supabase
            .from("cart_items")
            .delete()
            .eq("customer_id", owner)
            .in("product_id", removed);
          if (res.error) throw res.error;
        }
        if (
          ownerRef.current === owner &&
          JSON.stringify(cartRef.current) === JSON.stringify(lines)
        ) {
          writeCache(owner, lines, false);
          setSyncError("");
        }
      })
      .catch(() => {
        if (ownerRef.current === owner)
          setSyncError(
            "Your basket is saved on this device. Account sync failed.",
          );
      });
    return queue.current;
  }
  useEffect(() => {
    if (!authReady) return;
    let cancelled = false;
    const owner = currentUser?.id || null;
    ownerRef.current = owner;
    setProfile(null);
    setProfileReady(false);
    setCartReady(false);
    setSyncError("");
    setCartLoadError("");
    const cached = readCache(owner);
    setLocal(cached?.lines || [], owner, !!cached?.dirty);
    if (!owner || !supabase) {
      setProfileReady(true);
      setCartReady(true);
      return;
    }
    (async () => {
      try {
        const [p, c] = await Promise.all([
          supabase.from("profiles").select("*").eq("id", owner).maybeSingle(),
          supabase.from("cart_items").select("*").eq("customer_id", owner),
        ]);
        if (cancelled) return;
        if (p.error)
          notify(
            "Your profile could not be loaded. Please try signing in again.",
            "error",
          );
        setProfile({
          id: owner,
          name: p.data?.name || currentUser.user_metadata?.name || "",
          phone: p.data?.phone || "",
          isAdmin: p.data?.is_admin === true,
        });
        if (c.error) throw c.error;
        const saved = cached?.dirty
          ? cached?.lines || []
          : (c.data || []).map((r) => ({
              productId: String(r.product_id),
              qty: r.qty,
            }));
        const guest = readCache(null)?.lines || [];
        const next = setLocal(mergeCarts(saved, guest), owner, true);
        writeCache(null, [], false); // Consumed once; token refreshes never merge again.
        await sync(next, owner);
        if (!cancelled) setCartReady(true);
      } catch {
        if (!cancelled)
          setCartLoadError(
            "Your saved basket could not be loaded. Please retry before editing or checking out.",
          );
      } finally {
        if (!cancelled) setProfileReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authReady, currentUser?.id, supabase, loadRevision]);
  function commit(lines) {
    if (!cartReady) return;
    const next = setLocal(lines);
    sync(next, ownerRef.current);
  }
  function addToCart(productId, qty = 1, stock = 999) {
    if (!cartReady) return false;
    const previous =
      cartRef.current.find((l) => l.productId === String(productId))?.qty || 0;
    if (previous >= Number(stock)) {
      notify("You already have all available stock in your basket.", "error");
      return false;
    }
    commit(
      changeQuantity(
        cartRef.current,
        String(productId),
        previous + Number(qty),
        stock,
      ),
    );
    notify("Added to your basket");
    return true;
  }
  function setCartQty(productId, qty, stock = 999) {
    if (cartReady)
      commit(changeQuantity(cartRef.current, String(productId), qty, stock));
  }
  function removeFromCart(productId) {
    commit(cartRef.current.filter((l) => l.productId !== String(productId)));
  }
  function clearCart() {
    commit([]);
  }
  async function logOut() {
    await queue.current;
    const { error } = await supabase.auth.signOut();
    if (error) {
      notify("Could not sign out. Please try again.", "error");
      throw error;
    }
    setProfile(null);
    setSession(null);
    ownerRef.current = null;
    setLocal([], null, false);
  }
  return (
    <StoreContext.Provider
      value={{
        supabase,
        session,
        profile,
        currentUser,
        isAdmin: !!profile?.isAdmin,
        authReady,
        profileReady,
        cartReady,
        cartLoadError,
        retryCartLoad: () => setLoadRevision((n) => n + 1),
        cart,
        cartCount: cart.reduce((n, l) => n + l.qty, 0),
        addToCart,
        setCartQty,
        removeFromCart,
        clearCart,
        logOut,
        notify,
        syncError,
        retrySync: () => sync(cartRef.current, ownerRef.current),
      }}
    >
      {children}
      {notice && (
        <div
          className={`toast ${notice.type}`}
          role={notice.type === "error" ? "alert" : "status"}
        >
          {notice.message}
          <button
            aria-label="Dismiss notification"
            onClick={() => setNotice(null)}
          >
            ×
          </button>
        </div>
      )}
    </StoreContext.Provider>
  );
}
