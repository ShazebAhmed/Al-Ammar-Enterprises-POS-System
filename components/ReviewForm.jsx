"use client";
import { useState } from "react";
import { useStore } from "./Providers";
import StarInput from "./StarInput";

export default function ReviewForm({ productId, onPosted }) {
  const { supabase } = useStore();
  const [name, setName] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!name.trim() || !comment.trim() || submitting || !supabase) return;
    setSubmitting(true);
    setError("");
    try {
      const review = {
        product_id: productId,
        customer_name: name.trim(),
        rating,
        comment: comment.trim(),
      };
      const { error } = await supabase.from("reviews").insert(review);
      if (error) throw error;
      onPosted?.({
        name: review.customer_name,
        rating,
        comment: review.comment,
      });
      setName("");
      setComment("");
      setRating(5);
    } catch {
      setError("Your review could not be posted. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="stx-card px-4 py-4">
      <div className="stx-label" style={{ marginBottom: 10 }}>
        Leave a review
      </div>
      <div style={{ marginBottom: 10 }}>
        <StarInput value={rating} onChange={setRating} />
      </div>
      <input
        aria-label="Your name"
        maxLength={120}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your name"
        className="stx-input"
        style={{ marginBottom: 8 }}
        required
      />
      <textarea
        aria-label="Your review"
        maxLength={2000}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="What did you think?"
        className="stx-input"
        rows={3}
        required
      />
      {error && (
        <div className="inline-error" role="alert">
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={submitting || !supabase}
        className="stx-btn stx-btn-primary px-4 py-2 mt-2"
        style={{ fontSize: ".85rem" }}
      >
        {submitting ? "Posting…" : "Post review"}
      </button>
    </form>
  );
}
