"use client";
import { useEffect, useState } from "react";
import { useStore } from "./Providers";
import { lineStock } from "@/lib/cart";
import {
  DEFAULT_SETTINGS,
  settingsFromRow,
  productFromRow,
} from "@/lib/format";
// The basket's lines with current products and settings. `override` (lines like
// the basket's) is used instead of the basket, e.g. for "Buy now".
export default function useCartProducts(override) {
  const store = useStore();
  const cart = override || store.cart;
  const cartReady = override ? true : store.cartReady;
  const cartLoadError = override ? "" : store.cartLoadError;
  const { supabase, retryCartLoad } = store;
  const [data, setData] = useState({
    products: [],
    settings: DEFAULT_SETTINGS,
    loading: true,
    error: "",
  });
  const [revision, setRevision] = useState(0);
  const ids = [...new Set(cart.map((l) => l.productId))].sort().join(",");
  useEffect(() => {
    if (!cartReady) return;
    let cancelled = false;
    if (!supabase) {
      setData((d) => ({
        ...d,
        loading: false,
        error:
          "The store is temporarily unavailable. Please try again shortly.",
      }));
      return;
    }
    setData((d) => ({ ...d, loading: true, error: "" }));
    (async () => {
      try {
        const [p, s] = await Promise.all([
          ids
            ? supabase.from("products").select("*").in("id", ids.split(","))
            : Promise.resolve({ data: [] }),
          supabase.from("store_settings").select("*").eq("id", 1).maybeSingle(),
        ]);
        if (p.error || s.error) throw p.error || s.error;
        if (!cancelled)
          setData({
            products: (p.data || []).map(productFromRow),
            settings: s.data ? settingsFromRow(s.data) : DEFAULT_SETTINGS,
            loading: false,
            error: "",
          });
      } catch {
        if (!cancelled)
          setData((d) => ({
            ...d,
            loading: false,
            error:
              "Could not load current prices and availability. Please try again.",
          }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ids, cartReady, supabase, revision]);
  const lines = cart.map((l) => ({
    ...l,
    product: data.products.find((p) => String(p.id) === l.productId),
  }));
  const invalid = lines.some(
    (l) => !l.product || l.qty > lineStock(l.product, l.variant || ""),
  );
  return {
    ...data,
    loading: !cartLoadError && (data.loading || !cartReady),
    error: cartLoadError || data.error,
    lines,
    invalid,
    retry: () => (cartLoadError ? retryCartLoad() : setRevision((r) => r + 1)),
  };
}
