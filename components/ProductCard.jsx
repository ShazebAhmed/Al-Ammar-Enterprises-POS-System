import Link from "next/link";
import Icon from "./Icon";
import StarRow from "./StarRow";
import AddToCartButton from "./AddToCartButton";
import { formatMoney } from "@/lib/format";
export default function ProductCard({ product, settings, rating }) {
  const soldOut = Number(product.stock) <= 0;
  return (
    <article className="product-card">
      <Link className="product-image" href={`/product/${product.id}`}>
        {product.images?.[0] ? (
          <img
            src={product.images[0]}
            alt={product.name}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="product-placeholder">
            <Icon name="inventory_2" size={52} />
            <span>{product.category || "The collection"}</span>
          </div>
        )}
        {soldOut ? (
          <span className="product-badge">Sold out</span>
        ) : Number(product.stock) <= 5 ? (
          <span className="product-badge">Only {product.stock} left</span>
        ) : null}
        <span className="image-arrow">
          <Icon name="arrow_forward" size={18} />
        </span>
      </Link>
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
          <strong>{formatMoney(product.price, settings.currencySymbol)}</strong>
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
