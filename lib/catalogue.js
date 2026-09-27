import { cache } from "react";
import { createClient } from "./supabase";
import {
  settingsFromRow,
  productFromRow,
  reviewFromRow,
  DEFAULT_SETTINGS,
} from "./format";
export const getSettings = cache(async () => {
  const db = createClient();
  if (!db) return DEFAULT_SETTINGS;
  try {
    const { data } = await db
      .from("store_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    return data ? settingsFromRow(data) : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
});
export const getProduct = cache(async (id) => {
  const db = createClient();
  if (!db) return { product: null, reviews: [], unavailable: true };
  const [p, r] = await Promise.all([
    db.from("products").select("*").eq("id", id).maybeSingle(),
    db
      .from("reviews")
      .select("*")
      .eq("product_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  return {
    product: p.data ? productFromRow(p.data) : null,
    reviews: (r.data || []).map(reviewFromRow),
    unavailable: !!p.error,
  };
});
export async function getCatalogue({ category, q, sort, stock, page }) {
  const db = createClient();
  if (!db) return { products: [], count: 0, ratings: {}, unavailable: true };
  let query = db.from("products").select("*", { count: "exact" });
  if (category && category !== "All") query = query.eq("category", category);
  if (q) query = query.ilike("name", `%${q.replace(/[\\%_]/g, "\\$&")}%`);
  if (stock) query = query.gt("stock", 0);
  query =
    sort === "price-asc"
      ? query.order("price", { ascending: true })
      : sort === "price-desc"
        ? query.order("price", { ascending: false })
        : sort === "name"
          ? query.order("name", { ascending: true })
          : query.order("created_at", { ascending: false });
  const { data, error, count } = await query
    .order("id")
    .range((page - 1) * 12, page * 12 - 1);
  if (error) return { products: [], count: 0, ratings: {}, unavailable: true };
  const products = (data || []).map(productFromRow);
  const ratings = {};
  if (products.length) {
    const { data: reviews } = await db
      .from("reviews")
      .select("product_id,rating")
      .in(
        "product_id",
        products.map((p) => p.id),
      );
    for (const r of reviews || []) {
      const val = Number(r.rating);
      if (!(val >= 1 && val <= 5)) continue;
      const entry = (ratings[r.product_id] ||= { sum: 0, count: 0, avg: 0 });
      entry.sum += val;
      entry.count++;
      entry.avg = entry.sum / entry.count;
    }
  }
  return { products, count: count || 0, ratings, unavailable: false };
}
