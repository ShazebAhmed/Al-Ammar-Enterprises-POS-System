"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/components/Providers";

export default function ResetPasswordPage() {
  const { supabase, authReady, currentUser } = useStore();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!supabase || !currentUser || submitting) return;
    if (password.length < 8) {
      setError("Password should be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
    } catch (e) {
      setError(e.message || "Unable to update your password. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (authReady && !currentUser)
    return (
      <main className="page-wrap">
        <div className="inline-error">
          Open the password reset link in your email, or request a new link from
          Sign in.
        </div>
        <button
          className="stx-btn stx-btn-primary"
          onClick={() => router.push("/auth")}
        >
          Go to sign in
        </button>
      </main>
    );
  return (
    <main style={{ maxWidth: 420, margin: "0 auto" }} className="px-4 py-10">
      <div className="stx-card px-6 py-7">
        <div
          className="stx-display"
          style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: 16 }}
        >
          Set a new password
        </div>
        {done ? (
          <>
            <p
              style={{
                color: "var(--ink-soft)",
                fontSize: ".88rem",
                marginBottom: 16,
              }}
            >
              Your password has been updated.
            </p>
            <button
              onClick={() => router.push("/")}
              className="stx-btn stx-btn-primary px-5 py-2.5"
            >
              Continue
            </button>
          </>
        ) : (
          <form
            onSubmit={submit}
            style={{ display: "flex", flexDirection: "column", gap: 12 }}
          >
            <div>
              <label className="stx-label">New password</label>
              <input
                type="password"
                className="stx-input"
                style={{ marginTop: 4 }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div>
              <label className="stx-label">Confirm new password</label>
              <input
                type="password"
                className="stx-input"
                style={{ marginTop: 4 }}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            {error && (
              <div style={{ color: "var(--danger)", fontSize: ".82rem" }}>
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={submitting || !currentUser || !supabase}
              className="stx-btn stx-btn-primary"
              style={{ padding: "11px 0" }}
            >
              {submitting ? "Saving…" : "Save new password"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
