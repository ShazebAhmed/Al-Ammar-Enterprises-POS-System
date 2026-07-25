"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/components/Providers";

export default function AuthPage() {
  const { supabase } = useStore();
  const router = useRouter();
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError(""); setInfo("");

    if (mode === "forgot") {
      if (!email.trim()) { setError("Enter the email on your account."); return; }
      setSubmitting(true);
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: typeof window !== "undefined" ? `${window.location.origin}/reset-password` : undefined,
      });
      setSubmitting(false);
      if (error) setError(error.message); else setInfo("Check your email for a password reset link.");
      return;
    }

    if (mode === "signup") {
      if (!name.trim() || !email.trim() || !phone.trim() || !password) { setError("Please fill in every field."); return; }
      if (password.length < 6) { setError("Password should be at least 6 characters."); return; }
      if (password !== confirm) { setError("Passwords don't match."); return; }
      setSubmitting(true);
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(), password, options: { data: { name: name.trim(), phone: phone.trim() } },
      });
      setSubmitting(false);
      if (error) { setError(error.message); return; }
      if (!data.session) { setInfo("Account created! Check your email to confirm before signing in."); return; }
      router.push("/");
    } else {
      if (!email.trim() || !password) { setError("Enter your email and password."); return; }
      setSubmitting(true);
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      setSubmitting(false);
      if (error) { setError(error.message); return; }
      router.push("/");
    }
  }

  return (
    <main style={{ maxWidth: 420, margin: "0 auto" }} className="px-4 py-10">
      <div className="stx-card px-6 py-7">
        {mode !== "forgot" && (
          <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "#EFEBDD", borderRadius: 8, padding: 4 }}>
            <button type="button" onClick={() => { setMode("login"); setError(""); setInfo(""); }} className="stx-btn" style={{ flex: 1, padding: "8px 0", background: mode === "login" ? "var(--cream)" : "transparent", color: "var(--ink)" }}>Sign in</button>
            <button type="button" onClick={() => { setMode("signup"); setError(""); setInfo(""); }} className="stx-btn" style={{ flex: 1, padding: "8px 0", background: mode === "signup" ? "var(--cream)" : "transparent", color: "var(--ink)" }}>Create account</button>
          </div>
        )}

        <div className="stx-display" style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: 4 }}>
          {mode === "login" ? "Welcome back" : mode === "signup" ? "Create your account" : "Reset your password"}
        </div>
        <p style={{ fontSize: ".82rem", color: "var(--ink-soft)", marginBottom: 18 }}>
          {mode === "login" ? "Sign in to see your basket and past orders." : mode === "signup" ? "Save your basket and track orders across visits." : "We'll email you a link to set a new password."}
        </p>

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {mode === "signup" && (
            <div><label className="stx-label">Full name</label><input className="stx-input" style={{ marginTop: 4 }} value={name} onChange={(e) => setName(e.target.value)} /></div>
          )}
          <div><label className="stx-label">Email</label><input type="email" className="stx-input" style={{ marginTop: 4 }} value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          {mode === "signup" && (
            <div><label className="stx-label">Phone number</label><input className="stx-input" style={{ marginTop: 4 }} placeholder="03xx-xxxxxxx" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          )}
          {mode !== "forgot" && (
            <div><label className="stx-label">Password</label><input type="password" className="stx-input" style={{ marginTop: 4 }} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          )}
          {mode === "signup" && (
            <div><label className="stx-label">Confirm password</label><input type="password" className="stx-input" style={{ marginTop: 4 }} value={confirm} onChange={(e) => setConfirm(e.target.value)} /></div>
          )}
          {mode === "login" && (
            <button type="button" onClick={() => { setMode("forgot"); setError(""); setInfo(""); }} style={{ background: "none", border: "none", color: "var(--primary)", fontSize: ".8rem", textAlign: "right", cursor: "pointer", padding: 0 }}>Forgot password?</button>
          )}
          {error && <div style={{ color: "var(--danger)", fontSize: ".82rem" }}>{error}</div>}
          {info && <div style={{ color: "var(--primary)", fontSize: ".82rem" }}>{info}</div>}
          <button type="submit" disabled={submitting} className="stx-btn stx-btn-primary" style={{ padding: "11px 0", marginTop: 4 }}>
            {submitting ? "Please wait…" : mode === "login" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
          </button>
        </form>

        {mode === "forgot" ? (
          <button onClick={() => { setMode("login"); setError(""); setInfo(""); }} style={{ width: "100%", textAlign: "center", background: "none", border: "none", color: "var(--ink-soft)", marginTop: 14, cursor: "pointer", fontSize: ".85rem" }}>Back to sign in</button>
        ) : null}
      </div>
    </main>
  );
}
