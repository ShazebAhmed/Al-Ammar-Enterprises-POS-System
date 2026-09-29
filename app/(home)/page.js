import Link from "next/link";
import { getSettings, getCatalogue, getUsedCategories } from "@/lib/catalogue";
import { formatMoney, categoryTabs, deliveryLine } from "@/lib/format";
import Icon from "@/components/Icon";
import ProductCard from "@/components/ProductCard";
import { storeData, jsonLd } from "@/lib/seo";
import { photo, PHOTO_SIZES } from "@/lib/photo";
export const revalidate = 60;
// Filtered and sorted lists all point search engines at the main shop page.
export const metadata = { alternates: { canonical: "/" } };
const text = (value) => (typeof value === "string" ? value : "");
export default async function HomePage({ searchParams }) {
  const sp = await searchParams;
  const category = text(sp?.category) || "All";
  const q = text(sp?.q).trim().slice(0, 100);
  const sort = text(sp?.sort) || "newest";
  const stock = sp?.stock === "1";
  const page = Math.min(10000, Math.max(1, parseInt(sp?.page, 10) || 1));
  const [settings, result, used] = await Promise.all([
    getSettings(),
    getCatalogue({ category, q, sort, stock, page }),
    getUsedCategories(),
  ]);
  const { products, count, ratings, unavailable } = result;
  const categories = categoryTabs(settings.categories, used, category);
  const featured = products.find((p) => p.images?.[0]);
  function url(patch = {}) {
    const params = new URLSearchParams();
    const values = {
      category,
      q,
      sort,
      stock: stock ? "1" : "",
      page: String(page),
      ...patch,
    };
    for (const [k, v] of Object.entries(values))
      if (
        v &&
        !(k === "category" && v === "All") &&
        !(k === "page" && v === "1") &&
        !(k === "sort" && v === "newest")
      )
        params.set(k, v);
    return `/?${params.toString()}#collection`;
  }
  const filtered = category !== "All" || q || stock;
  return (
    <main className="store-home">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(storeData(settings)) }}
      />
      {!filtered && page === 1 && (
        <section className="container hero">
          <div className="hero-copy">
            <span className="eyebrow">
              <span className="tiny-line" /> WELCOME TO{" "}
              {settings.storeName || "AL-AMMAR"}
            </span>
            <h1>
              Everyday finds.
              <br />
              <em>Extraordinary</em>{" "}
              {/* Hidden on narrow screens; the space above keeps the words apart. */}
              <br />
              little moments.
            </h1>
            <p>
              {settings.tagline ||
                "Good things for your home, your routine, and everything in between. All in one thoughtfully curated place."}
            </p>
            <Link
              href="#collection"
              className="stx-btn stx-btn-primary hero-cta"
            >
              Explore the collection <Icon name="arrow_forward" />
            </Link>
            <div className="hero-note">
              <span className="little-circle">
                <Icon name="check" size={13} />
              </span>
              Simple ordering. Cash on delivery.
            </div>
          </div>
          <div className={`hero-visual${featured ? " has-photo" : ""}`}>
            <div className="hero-orbit" />
            <span className="hero-edition">THE EVERYDAY EDIT / 01</span>
            {featured ? (
              <>
                <img
                  className="hero-image"
                  {...photo(featured.images[0], PHOTO_SIZES.hero)}
                  alt={featured.name}
                  fetchPriority="high"
                />
                <Link className="hero-product" href={`/product/${featured.id}`}>
                  <div>
                    <small>IN THE SPOTLIGHT</small>
                    <strong>{featured.name}</strong>
                    <span>
                      {formatMoney(featured.price, settings.currencySymbol)}
                    </span>
                  </div>
                  <span className="round-button">
                    <Icon name="arrow_forward" />
                  </span>
                </Link>
              </>
            ) : (
              <div className="hero-empty-art" aria-hidden="true">
                <span className="art-circle" />
                <div className="art-box box-one">
                  A<span>AL-AMMAR</span>
                </div>
                <div className="art-box box-two">
                  Everyday.
                  <br />
                  Considered.
                </div>
              </div>
            )}
            <div className="hero-seal">
              A LITTLE
              <br />
              <strong>better</strong>
              <br />
              EVERY DAY
            </div>
          </div>
        </section>
      )}
      <section className="trust-strip">
        <div className="container trust-inner">
          <div>
            <Icon name="local_shipping" size={23} />
            <span>
              <strong>Delivered to your door</strong>
              <small>{deliveryLine(settings)}</small>
            </span>
          </div>
          <div>
            <Icon name="account_balance_wallet" size={23} />
            <span>
              <strong>Pay when it arrives</strong>
              <small>Cash on delivery available</small>
            </span>
          </div>
          <div>
            <Icon name="call" size={23} />
            <span>
              <strong>A personal touch</strong>
              <small>Phone confirmation before dispatch</small>
            </span>
          </div>
        </div>
      </section>
      <section className="container collection" id="collection">
        <div className="section-heading">
          <div>
            <span className="eyebrow">FIND YOUR EVERYDAY</span>
            <h2>
              {q
                ? `Results for “${q}”`
                : category === "All"
                  ? "The collection"
                  : category}
              <span className="gold-dot">.</span>
            </h2>
          </div>
          {!unavailable && (
            <span className="collection-count">
              {count} {count === 1 ? "find" : "finds"} to explore
            </span>
          )}
        </div>
        <div
          className="category-tabs"
          id="categories"
          aria-label="Product categories"
        >
          {categories.map((cat) => (
            <Link
              key={cat}
              href={url({ category: cat, page: "1" })}
              className={category === cat ? "active" : ""}
              aria-current={category === cat ? "page" : undefined}
            >
              {cat === "All" ? "All products" : cat}
            </Link>
          ))}
        </div>
        <form className="catalogue-toolbar" action="/#collection" method="get">
          <input type="hidden" name="category" value={category} />
          <label className="catalogue-search">
            <Icon name="search" />
            <input
              name="q"
              defaultValue={q}
              key={q}
              placeholder="Find something you’ll love…"
              aria-label="Search products"
            />
          </label>
          <label className="stock-toggle">
            <input
              type="checkbox"
              name="stock"
              value="1"
              defaultChecked={stock}
              key={String(stock)}
            />{" "}
            In stock only
          </label>
          <label className="sort-field">
            <span>Sort by</span>
            <select
              name="sort"
              defaultValue={sort}
              key={sort}
              aria-label="Sort products"
            >
              <option value="newest">Latest arrivals</option>
              <option value="price-asc">Price: low to high</option>
              <option value="price-desc">Price: high to low</option>
              <option value="name">Name: A to Z</option>
            </select>
          </label>
          <button className="filter-button" type="submit">
            <Icon name="tune" size={16} /> Apply
          </button>
        </form>
        {unavailable ? (
          <div className="empty-state">
            <Icon name="warning" size={36} />
            <h3>We’re having trouble loading the collection.</h3>
            <p>
              Please try again shortly. Your saved basket is still on this
              device.
            </p>
            <Link href="/" className="stx-btn stx-btn-outline">
              Try again
            </Link>
          </div>
        ) : products.length ? (
          <>
            <div className="product-grid">
              {products.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  settings={settings}
                  rating={ratings[p.id]}
                />
              ))}
            </div>
            {count > 12 && (
              <nav className="pagination" aria-label="Catalogue pages">
                {page > 1 && (
                  <Link href={url({ page: String(page - 1) })}>← Previous</Link>
                )}
                <span>
                  Page {page} of {Math.ceil(count / 12)}
                </span>
                {page * 12 < count && (
                  <Link href={url({ page: String(page + 1) })}>Next →</Link>
                )}
              </nav>
            )}
          </>
        ) : (
          <div className="empty-state">
            <Icon name="inventory_2" size={38} />
            <h3>
              {filtered
                ? "No finds just yet."
                : "Good things are on their way."}
            </h3>
            <p>
              {filtered
                ? "Try a different search or explore the full collection."
                : "Our shelves are being prepared. Come back soon to discover the collection."}
            </p>
            {(filtered || page > 1) && (
              <Link className="stx-btn stx-btn-outline" href="/#collection">
                View all products
              </Link>
            )}
          </div>
        )}
      </section>
      <section className="container brand-note">
        <span className="eyebrow">LESS SEARCHING. MORE LIVING.</span>
        <h2>
          Your everyday essentials,
          <br />
          <em>all under one roof.</em>
        </h2>
        <Link href="#collection">
          Find your next favourite <Icon name="arrow_forward" size={18} />
        </Link>
      </section>
    </main>
  );
}
