import Link from "next/link";
import Icon from "./Icon";
import StarRow from "./StarRow";
import AddToCartButton from "./AddToCartButton";
import { formatMoney } from "@/lib/format";

export default function ProductCard({ product, settings, rating }) {
  return (
    <div className="stx-card overflow-hidden" style={{ display: "flex", flexDirection: "column" }}>
      <Link href={`/product/${product.id}`}>
        <div style={{ aspectRatio: "1/1", background: "#EFEBDD", overflow: "hidden" }}>
          {product.images?.[0] ? (
            <img src={product.images[0]} alt={product.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="inventory_2" size={28} color="var(--ink-soft)" />
            </div>
          )}
        </div>
      </Link>
      <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
        <Link href={`/product/${product.id}`}>
          <div style={{ fontWeight: 600, fontSize: ".9rem", lineHeight: 1.3 }}>{product.name}</div>
        </Link>
        {rating?.count > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <StarRow value={rating.avg} size={12} />
            <span style={{ fontSize: ".72rem", color: "var(--ink-soft)" }}>({rating.count})</span>
          </div>
        )}
        <div className="stx-mono" style={{ fontWeight: 700, marginTop: 2 }}>{formatMoney(product.price, settings.currencySymbol)}</div>
        {Number(product.stock) <= 0 ? (
          <span className="badge-sale" style={{ width: "fit-content" }}>Out of stock</span>
        ) : (
          <AddToCartButton productId={product.id} style={{ marginTop: "auto" }} />
        )}
      </div>
    </div>
  );
}
