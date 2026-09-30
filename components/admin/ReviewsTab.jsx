"use client";
import Icon from "@/components/Icon";
import StarRow from "@/components/StarRow";

export default function ReviewsTab({ reviews, products, onDelete, onApprove }) {
  const pending = reviews.filter((r) => !r.approved).length;
  const ordered = [...reviews].sort(
    (a, b) => Number(a.approved) - Number(b.approved),
  );
  return (
    <div>
      <div
        className="stx-display"
        style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: 18 }}
      >
        Reviews
      </div>
      {pending > 0 && (
        <p style={{ color: "var(--ink-soft)", marginBottom: 12 }}>
          {pending} {pending === 1 ? "review is" : "reviews are"} waiting for
          approval. Customers only see approved reviews.
        </p>
      )}
      {reviews.length === 0 ? (
        <div className="stx-card px-6 py-12 text-center">
          <Icon name="chat" size={28} color="var(--ink-soft)" />
          <p style={{ color: "var(--ink-soft)", marginTop: 10 }}>
            No reviews yet.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {ordered.map((r) => {
            const product = products.find((p) => p.id === r.productId);
            return (
              <div
                key={r.id}
                className="stx-card px-4 py-3"
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 12,
                  alignItems: "flex-start",
                }}
              >
                <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span style={{ fontWeight: 600, fontSize: ".88rem" }}>
                      {r.name}
                    </span>
                    <StarRow value={r.rating} size={12} />
                    {!r.approved && (
                      <span
                        style={{
                          fontSize: ".72rem",
                          fontWeight: 600,
                          color: "var(--danger)",
                        }}
                      >
                        Awaiting approval
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: ".76rem",
                      color: "var(--ink-soft)",
                      marginTop: 2,
                    }}
                  >
                    on {product ? product.name : "a deleted product"}
                  </div>
                  <p
                    style={{
                      fontSize: ".84rem",
                      marginTop: 6,
                      overflowWrap: "anywhere",
                    }}
                  >
                    {r.comment}
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  {!r.approved && (
                    <button
                      type="button"
                      className="stx-btn stx-btn-primary px-3 py-1"
                      style={{ fontSize: ".8rem" }}
                      onClick={() => onApprove(r.id)}
                    >
                      Approve
                    </button>
                  )}
                  <button
                    aria-label="Delete review"
                    onClick={() => {
                      if (window.confirm("Delete this review?")) onDelete(r.id);
                    }}
                    className="icon-button"
                    style={{ color: "var(--danger)" }}
                  >
                    <Icon name="delete" size={17} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
