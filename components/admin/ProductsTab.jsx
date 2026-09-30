"use client";
import { useState } from "react";
import Icon from "@/components/Icon";
import { formatMoney } from "@/lib/format";
import { photo, PHOTO_SIZES } from "@/lib/photo";
import { optionPicker } from "@/lib/productOptions";

// "3 colours · 4 sizes" under a product's name.
function optionSummary(product) {
  if (!product.variants?.length) return "";
  const { colors, sizes, sizeLabel } = optionPicker(product);
  const count = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
  return [
    colors.length && count(colors.length, "colour"),
    sizes.length && count(sizes.length, sizeLabel.toLowerCase()),
  ]
    .filter(Boolean)
    .join(" · ");
}

export default function ProductsTab({
  products,
  settings,
  onAdd,
  onEdit,
  onDelete,
}) {
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [search, setSearch] = useState("");
  const visible = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 18,
        }}
      >
        <div
          className="stx-display"
          style={{ fontSize: "1.4rem", fontWeight: 700 }}
        >
          Products
        </div>
        <button
          onClick={onAdd}
          className="stx-btn stx-btn-primary px-4 py-2 flex items-center gap-2"
          style={{ display: "flex" }}
        >
          <Icon name="add_circle" size={17} color="#fff" /> Add product
        </button>
      </div>
      <div className="admin-tools">
        <input
          className="stx-input"
          aria-label="Search products"
          placeholder="Search products…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {products.length === 0 ? (
        <div className="stx-card px-6 py-12 text-center">
          <Icon name="inventory_2" size={28} color="var(--ink-soft)" />
          <p style={{ color: "var(--ink-soft)", marginTop: 10 }}>
            No products yet. Add your first one to open the store.
          </p>
        </div>
      ) : (
        <div className="stx-card" style={{ overflow: "hidden" }}>
          {visible.map((p, i) => (
            <div
              key={p.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 16px",
                borderTop: i ? "1px solid var(--line)" : "none",
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 8,
                  overflow: "hidden",
                  background: "#EFEBDD",
                  flexShrink: 0,
                }}
              >
                {p.images?.[0] && (
                  <img
                    {...photo(p.images[0], PHOTO_SIZES.thumb)}
                    alt=""
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                )}
              </div>
              <div style={{ flex: 1, minWidth: 120 }}>
                <div style={{ fontWeight: 600, fontSize: ".88rem" }}>
                  {p.name}
                </div>
                <div style={{ fontSize: ".76rem", color: "var(--ink-soft)" }}>
                  {[p.category || "Uncategorised", optionSummary(p)]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>
              <div
                className="stx-mono"
                style={{ fontSize: ".85rem", minWidth: 80 }}
              >
                {formatMoney(p.price, settings.currencySymbol)}
              </div>
              <div
                style={{
                  fontSize: ".8rem",
                  color:
                    Number(p.stock) <= 5 ? "var(--brick)" : "var(--ink-soft)",
                  minWidth: 70,
                }}
              >
                {p.stock} in stock
              </div>
              <button
                onClick={() => onEdit(p)}
                className="stx-btn stx-btn-outline"
                style={{
                  padding: "6px 10px",
                  fontSize: ".78rem",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Icon name="edit" size={14} /> Edit
              </button>
              {confirmDelete === p.id ? (
                <div style={{ display: "flex", gap: 4 }}>
                  <button
                    onClick={async () => {
                      await onDelete(p.id);
                      setConfirmDelete(null);
                    }}
                    className="stx-btn"
                    style={{
                      background: "var(--danger)",
                      color: "#fff",
                      padding: "6px 10px",
                      fontSize: ".78rem",
                    }}
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setConfirmDelete(null)}
                    className="stx-btn stx-btn-outline"
                    style={{ padding: "6px 10px", fontSize: ".78rem" }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  aria-label={`Delete ${p.name}`}
                  onClick={() => setConfirmDelete(p.id)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--danger)",
                    cursor: "pointer",
                  }}
                >
                  <Icon name="delete" size={17} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
