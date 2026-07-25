"use client";
import { useState } from "react";
import { useStore } from "./Providers";
import StarInput from "./StarInput";

export default function ReviewForm({ productId, onPosted }) {
  const { supabase } = useStore();
  const [name, setName] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!name.trim() || !comment.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from("reviews").insert({
      product_id: productId, customer_name: name.trim(), rating, comment: comment.trim(),
    });
    setSubmitting(false);
    if (!error) {
      setName(""); setComment(""); setRating(5);
      onPosted?.({ name: name.trim(), rating, comment: comment.trim() });
    }
  }

  return (
    <form onSubmit={submit} className="stx-card px-4 py-4">
      <div className="stx-label" style={{ marginBottom: 10 }}>Leave a review</div>
      <div style={{ marginBottom: 10 }}><StarInput value={rating} onChange={setRating} /></div>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="stx-input" style={{ marginBottom: 8 }} required />
      <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="What did you think?" className="stx-input" rows={3} required />
      <button type="submit" disabled={submitting} className="stx-btn stx-btn-primary px-4 py-2 mt-2" style={{ fontSize: ".85rem" }}>
        {submitting ? "Posting…" : "Post review"}
      </button>
    </form>
  );
}
