import Link from "next/link";
import Icon from "./Icon";
import StarRow from "./StarRow";
import AddToCartButton from "./AddToCartButton";
import CardGallery from "./CardGallery";
import { formatMoney, salePercent } from "@/lib/format";
export default function ProductCard({ product, settings, rating }) {
  const soldOut = Number(product.stock) <= 0;
  const off = salePercent(product);
  return (
    <article className="product-card">
      <div className="product-image">
        {product.images?.[0] ? (
          <CardGallery
            images={product.images}
            name={product.name}
            href={`/product/${product.id}`}
          />
        ) : (
          <Link
            className="card-slide product-placeholder"
            href={`/product/${product.id}`}
          >
            <Icon name="inventory_2" size={52} />
            <span>{product.category || "The collection"}</span>
          </Link>
        )}
        {soldOut ? (
          <span className="product-badge">Sold out</span>
        ) : off ? (
          <span className="product-badge sale">{off}% off</span>
        ) : Number(product.stock) <= 5 ? (
          <span className="product-badge">Only {product.stock} left</span>
        ) : null}
      </div>
      <div className="product-body">
        <span className="product-category">
          {product.category || "Essentials"}
        </span>
        <Link href={`/product/${product.id}`}>
          <h3>{product.name}</h3>
        </Link>
        {rating?.count > 0 && (
          <div className="rating">
            <StarRow value={rating.avg} size={12} />
            <span>
              {rating.avg.toFixed(1)} ({rating.count})
            </span>
          </div>
        )}
        <div className="product-bottom">
          <strong>
            {formatMoney(product.price, settings.currencySymbol)}
            {off > 0 && (
              <s className="was-price">
                {formatMoney(product.compareAtPrice, settings.currencySymbol)}
              </s>
            )}
          </strong>
          {soldOut ? (
            <span className="muted small">Unavailable</span>
          ) : (
            <AddToCartButton productId={product.id} stock={product.stock} />
          )}
        </div>
      </div>
    </article>
  );
}
