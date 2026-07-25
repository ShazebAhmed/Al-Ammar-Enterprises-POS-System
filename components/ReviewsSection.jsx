"use client";
import { useState } from "react";
import StarRow from "./StarRow";
import ReviewForm from "./ReviewForm";
import { uid } from "@/lib/format";

export default function ReviewsSection({ productId, initialReviews }) {
  const [reviews, setReviews] = useState(initialReviews);
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

  function handlePosted(newReview) {
    setReviews((list) => [{ ...newReview, id: uid("rv_"), productId }, ...list]);
  }

  return (
    <div style={{ marginTop: 32 }}>
      <div className="stx-display" style={{ fontWeight: 700, fontSize: "1.2rem", marginBottom: 4 }}>Reviews</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <StarRow value={avg} size={15} />
        <span style={{ fontSize: ".85rem", color: "var(--ink-soft)" }}>
          {reviews.length ? `${avg.toFixed(1)} · ${reviews.length} review${reviews.length > 1 ? "s" : ""}` : "No reviews yet"}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 22 }}>
        {reviews.map((r) => (
          <div key={r.id} className="stx-card px-4 py-3">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 600, fontSize: ".88rem" }}>{r.name}</span>
              <StarRow value={r.rating} size={12} />
            </div>
            <p style={{ fontSize: ".85rem", color: "var(--ink-soft)", marginTop: 4 }}>{r.comment}</p>
          </div>
        ))}
      </div>

      <ReviewForm productId={productId} onPosted={handlePosted} />
    </div>
  );
}
