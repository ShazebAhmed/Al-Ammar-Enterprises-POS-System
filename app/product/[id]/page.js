import { notFound } from "next/navigation";
import Link from "next/link";
import { getSettings, getProduct } from "@/lib/catalogue";
import {
  settingsFromRow,
  productFromRow,
  reviewFromRow,
  DEFAULT_SETTINGS,
  getVideoEmbed,
} from "@/lib/format";
import Icon from "@/components/Icon";
import ImageGallery from "@/components/ImageGallery";
import ProductPurchasePanel from "@/components/ProductPurchasePanel";
import ReviewsSection from "@/components/ReviewsSection";

export const revalidate = 60;

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
    description: (
      product.description || `Buy ${product.name} at ${storeName}.`
    ).slice(0, 160),
    openGraph: {
      title: `${product.name} · ${storeName}`,
      description: (product.description || "").slice(0, 160),
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

  return (
    <main className="page-wrap">
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

        <aside>
          <ProductPurchasePanel product={product} settings={settings} />
        </aside>
      </div>
    </main>
  );
}
