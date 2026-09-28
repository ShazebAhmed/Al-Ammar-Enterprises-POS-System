"use client";
import { useState } from "react";
import Link from "next/link";
import { useStore } from "./Providers";

// "Your details" on the account page: name and phone (filled in at checkout),
// and a link to change the password.
export default function ProfileForm() {
  const { profile, updateProfile } = useStore();
  const [form, setForm] = useState({
    name: profile.name || "",
    phone: profile.phone || "",
  });
  const [status, setStatus] = useState({
    saving: false,
    error: "",
    saved: false,
  });
  async function save(e) {
    e.preventDefault();
    const name = form.name.trim();
    const phone = form.phone.trim();
    if (!name) return setStatus({ error: "Please enter your name." });
    if (phone && !/^\+?[\d\s()-]{7,30}$/.test(phone))
      return setStatus({ error: "Please enter a valid phone number." });
    setStatus({ saving: true });
    try {
      await updateProfile({ name, phone });
      setStatus({ saved: true });
    } catch {
      setStatus({ error: "Could not save your details. Please try again." });
    }
  }
  const changed =
    form.name.trim() !== (profile.name || "") ||
    form.phone.trim() !== (profile.phone || "");
  return (
    <form className="stx-card px-5 py-5 mb-6 profile-form" onSubmit={save}>
      <div className="stx-label">Your details</div>
      <div className="form-grid">
        <label className="form-field">
          Full name
          <input
            className="stx-input"
            name="name"
            autoComplete="name"
            maxLength={120}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </label>
        <label className="form-field">
          Phone number
          <input
            className="stx-input"
            name="phone"
            type="tel"
            autoComplete="tel"
            maxLength={30}
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </label>
      </div>
      {status.error && (
        <div className="inline-error" role="alert">
          {status.error}
        </div>
      )}
      <div className="profile-actions">
        <button
          className="stx-btn stx-btn-primary"
          disabled={status.saving || !changed}
        >
          {status.saving ? "Saving…" : "Save details"}
        </button>
        {status.saved && !changed && (
          <span className="muted small" role="status">
            Saved.
          </span>
        )}
        <Link href="/reset-password" className="text-link">
          Change password
        </Link>
      </div>
    </form>
  );
}
