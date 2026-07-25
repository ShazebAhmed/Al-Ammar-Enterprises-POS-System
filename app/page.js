import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { settingsFromRow, productFromRow, DEFAULT_SETTINGS } from "@/lib/format";
import Icon from "@/components/Icon";
import ProductCard from "@/components/ProductCard";

export const revalidate = 60;

async function getData() {
  const supabase = createClient();
  const [settingsRes, productsRes, reviewsRes] = await Promise.all([
    supabase.from("store_settings").select("*").eq("id", 1).single(),
    supabase.from("products").select("*").order("created_at", { ascending: false }),
    supabase.from("reviews").select("product_id, rating"),
  ]);
  const settings = settingsRes.data ? settingsFromRow(settingsRes.data) : DEFAULT_SETTINGS;
  const products = (productsRes.data || []).map(productFromRow);
  const reviews = reviewsRes.data || [];
  return { settings, products, reviews };
}

function ratingsByProduct(reviews) {
  const map = {};
  for (const r of reviews) {
    if (!map[r.product_id]) map[r.product_id] = { sum: 0, count: 0 };
    map[r.product_id].sum += r.rating;
    map[r.product_id].count += 1;
  }
  const out = {};
  for (const id in map) out[id] = { avg: map[id].sum / map[id].count, count: map[id].count };
  return out;
}

export default async function HomePage({ searchParams }) {
  const sp = await searchParams;
  const activeCategory = sp?.category || "All";
  const search = sp?.q || "";

  const { settings, products, reviews } = await getData();
  const ratings = ratingsByProduct(reviews);
  const categories = ["All", ...(settings.categories || [])];

  const visibleProducts = products.filter((p) => {
    const matchesCat = activeCategory === "All" || p.category === activeCategory;
    const matchesSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <main style={{ maxWidth: 1120, margin: "0 auto" }} className="px-4 py-6">
      <section style={{ padding: "28px 0 20px" }}>
        <h1 className="stx-display" style={{ fontSize: "2rem", fontWeight: 700, lineHeight: 1.1, margin: 0 }}>
          {settings.tagline || "Everything on the shelf, one stall at a time."}
        </h1>
        <p style={{ color: "var(--ink-soft)", marginTop: 8, maxWidth: 560 }}>
          Browse the aisles below, add what you need to your basket, and check out with cash on delivery or a quick phone confirmation.
        </p>
      </section>

      <form action="/" method="get" style={{ maxWidth: 420, marginBottom: 18, position: "relative" }}>
        {activeCategory !== "All" && <input type="hidden" name="category" value={activeCategory} />}
        <Icon name="search" size={17} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--ink-soft)" }} />
        <input name="q" defaultValue={search} placeholder="Search products…" className="stx-input" style={{ paddingLeft: 32 }} />
      </form>

      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 10, marginBottom: 22 }}>
        {categories.map((cat, i) => (
          <Link key={cat} href={cat === "All" ? "/" : `/?category=${encodeURIComponent(cat)}`} className={`stall-tag ${activeCategory === cat ? "active" : ""}`}>
            <span className="stall-num">STALL {String(i).padStart(2, "0")}</span>{cat}
          </Link>
        ))}
      </div>

      {products.length === 0 ? (
        <div className="stx-card px-6 py-14 text-center">
          <Icon name="remove_shopping_cart" size={34} color="var(--ink-soft)" />
          <div className="stx-display" style={{ fontSize: "1.2rem", fontWeight: 700, marginTop: 10 }}>The shelves are empty</div>
          <p style={{ color: "var(--ink-soft)", marginTop: 6 }}>Check back soon — we're stocking up.</p>
        </div>
      ) : visibleProducts.length === 0 ? (
        <div className="stx-card px-6 py-14 text-center">
          <Icon name="search_off" size={30} color="var(--ink-soft)" />
          <div style={{ fontWeight: 700, marginTop: 10 }}>No products match that search</div>
          <p style={{ color: "var(--ink-soft)", marginTop: 4 }}>Try another keyword or a different stall.</p>
        </div>
      ) : (
        <div className="product-grid">
          {visibleProducts.map((p) => (
            <ProductCard key={p.id} product={p} settings={settings} rating={ratings[p.id]} />
          ))}
        </div>
      )}
    </main>
  );
}
