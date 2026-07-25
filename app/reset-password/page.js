"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/components/Providers";

export default function ResetPasswordPage() {
  const { supabase } = useStore();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (password.length < 6) { setError("Password should be at least 6 characters."); return; }
    if (password !== confirm) { setError("Passwords don't match."); return; }
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (error) setError(error.message); else setDone(true);
  }

  return (
    <main style={{ maxWidth: 420, margin: "0 auto" }} className="px-4 py-10">
      <div className="stx-card px-6 py-7">
        <div className="stx-display" style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: 16 }}>Set a new password</div>
        {done ? (
          <>
            <p style={{ color: "var(--ink-soft)", fontSize: ".88rem", marginBottom: 16 }}>Your password has been updated.</p>
            <button onClick={() => router.push("/")} className="stx-btn stx-btn-primary px-5 py-2.5">Continue</button>
          </>
        ) : (
          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div><label className="stx-label">New password</label><input type="password" className="stx-input" style={{ marginTop: 4 }} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            <div><label className="stx-label">Confirm new password</label><input type="password" className="stx-input" style={{ marginTop: 4 }} value={confirm} onChange={(e) => setConfirm(e.target.value)} /></div>
            {error && <div style={{ color: "var(--danger)", fontSize: ".82rem" }}>{error}</div>}
            <button type="submit" disabled={submitting} className="stx-btn stx-btn-primary" style={{ padding: "11px 0" }}>{submitting ? "Saving…" : "Save new password"}</button>
          </form>
        )}
      </div>
    </main>
  );
}
