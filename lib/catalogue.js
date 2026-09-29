import { cache } from "react";
import { createClient } from "./supabase";
import {
  settingsFromRow,
  productFromRow,
  reviewFromRow,
  DEFAULT_SETTINGS,
  searchFilter,
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
// Categories that have at least one product, or null if they could not be read.
export const getUsedCategories = cache(async () => {
  const db = createClient();
  if (!db) return null;
  const { data, error } = await db.from("products").select("category");
  if (error) return null;
  return [...new Set(data.map((row) => row.category).filter(Boolean))];
});
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const getProduct = cache(async (id) => {
  // A malformed id is simply a missing product (404), not a database failure.
  if (!UUID.test(id)) return { product: null, reviews: [], unavailable: false };
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
// Up to four other products for "You may also like": in stock ones from the same
// category first, then the newest from the rest of the shop.
export const getRelated = cache(async (product, limit = 4) => {
  const db = createClient();
  if (!db) return [];
  const pick = (query) =>
    query.neq("id", product.id).gt("stock", 0).limit(limit);
  const same = product.category
    ? await pick(
        db.from("products").select("*").eq("category", product.category),
      )
    : { data: [] };
  const found = same.data || [];
  if (found.length < limit) {
    const { data } = await pick(
      db.from("products").select("*").order("created_at", { ascending: false }),
    );
    for (const row of data || [])
      if (found.length < limit && !found.some((f) => f.id === row.id))
        found.push(row);
  }
  return found.map(productFromRow);
});
export async function getCatalogue({ category, q, sort, stock, page }) {
  const db = createClient();
  if (!db) return { products: [], count: 0, ratings: {}, unavailable: true };
  let query = db.from("products").select("*", { count: "exact" });
  if (category && category !== "All") query = query.eq("category", category);
  if (q) query = query.or(searchFilter(q));
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
