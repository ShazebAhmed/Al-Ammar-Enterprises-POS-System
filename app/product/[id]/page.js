import { notFound } from "next/navigation";
import Link from "next/link";
import { getSettings, getProduct, getRelated } from "@/lib/catalogue";
import { getVideoEmbed, descriptionSummary } from "@/lib/format";
import Icon from "@/components/Icon";
import ImageGallery from "@/components/ImageGallery";
import ProductPurchasePanel from "@/components/ProductPurchasePanel";
import ReviewsSection from "@/components/ReviewsSection";
import ProductCard from "@/components/ProductCard";
import ShareButton from "@/components/ShareButton";
import { productData, jsonLd } from "@/lib/seo";

export const revalidate = 60;
// Pages are made on first visit and then cached, refreshed at most once a minute.
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const [settings, { product }] = await Promise.all([
    getSettings(),
    getProduct(id),
  ]);
  if (!product) return { title: "Product not found" };
  const storeName = settings.storeName || "Online Store";
  return {
    title: product.name,
    description:
      descriptionSummary(product.description) ||
      `Buy ${product.name} at ${storeName}.`,
    alternates: { canonical: `/product/${product.id}` },
    openGraph: {
      type: "website",
      url: `/product/${product.id}`,
      title: `${product.name} · ${storeName}`,
      description: descriptionSummary(product.description),
      images: product.images?.[0] ? [product.images[0]] : [],
    },
  };
}

export default async function ProductPage({ params }) {
  const { id } = await params;
  const [settings, { product, reviews, unavailable }] = await Promise.all([
    getSettings(),
    getProduct(id),
  ]);
  if (unavailable) throw new Error("Product data unavailable");

  if (!product) return notFound();

  const video = getVideoEmbed(product.videoUrl);
  const related = await getRelated(product);
  return (
    <main className="page-wrap">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(productData(product, settings, reviews)),
        }}
      />
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

      <div className="pdp-grid">
        <div className="pdp-main">
          <ImageGallery images={product.images} name={product.name} />

          {video && (
            <div style={{ marginTop: 18 }}>
              <div
                className="stx-label"
                style={{
                  marginBottom: 8,
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <Icon name="videocam" size={15} /> Product video
              </div>
              {video.type === "youtube" ? (
                <div
                  style={{
                    position: "relative",
                    paddingTop: "56.25%",
                    borderRadius: 10,
                    overflow: "hidden",
                  }}
                >
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${video.id}`}
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      border: 0,
                    }}
                    allowFullScreen
                    title="Product video"
                  />
                </div>
              ) : (
                <video
                  src={video.src}
                  controls
                  style={{ width: "100%", borderRadius: 10 }}
                />
              )}
            </div>
          )}

          <div style={{ marginTop: 28 }}>
            <div
              className="stx-display"
              style={{ fontWeight: 700, fontSize: "1.2rem", marginBottom: 8 }}
            >
              Description
            </div>
            <p
              style={{
                color: "var(--ink-soft)",
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
              }}
            >
              {product.description || "No description yet."}
            </p>
          </div>

          <ReviewsSection productId={product.id} initialReviews={reviews} />
        </div>

        <aside className="pdp-side">
          <ProductPurchasePanel product={product} settings={settings} />
          <ShareButton title={product.name} />
        </aside>
      </div>

      {related.length > 0 && (
        <section className="related-products" aria-labelledby="related-title">
          <h2 id="related-title" className="stx-display">
            You may also like
          </h2>
          <div className="product-grid">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} settings={settings} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
