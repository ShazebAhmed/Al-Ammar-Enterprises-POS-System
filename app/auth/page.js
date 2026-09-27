"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/components/Providers";
// Where to go after signing in: ?next=/admin (same-site paths only), else the account page.
// The target is also kept for this tab, so tapping "Sign in" in the header
// (which reloads /auth without ?next) still returns the admin app to /admin.
function afterSignIn() {
  let next = new URLSearchParams(window.location.search).get("next") || "";
  try {
    next = next || sessionStorage.getItem("authNext") || "";
    sessionStorage.removeItem("authNext");
  } catch {}
  return next.startsWith("/") && !next.startsWith("//") ? next : "/account";
}

export default function AuthPage() {
  const { supabase } = useStore();
  const router = useRouter();
  const [mode, setMode] = useState("login"),
    [form, setForm] = useState({
      name: "",
      email: "",
      phone: "",
      password: "",
      confirm: "",
    }),
    [error, setError] = useState(""),
    [info, setInfo] = useState(""),
    [submitting, setSubmitting] = useState(false);
  const busy = useRef(false);
  useEffect(() => {
    const next = new URLSearchParams(window.location.search).get("next");
    try {
      if (next) sessionStorage.setItem("authNext", next);
    } catch {}
  }, []);
  function changeMode(next) {
    setMode(next);
    setError("");
    setInfo("");
  }
  async function submit(e) {
    e.preventDefault();
    if (busy.current || !supabase) return;
    setError("");
    setInfo("");
    if (mode === "signup" && form.password !== form.confirm) {
      setError("Your passwords do not match.");
      return;
    }
    busy.current = true;
    setSubmitting(true);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(
          form.email.trim(),
          { redirectTo: `${window.location.origin}/reset-password` },
        );
        if (error) throw error;
        setInfo(
          "If an account exists, a password reset link will arrive by email.",
        );
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: form.email.trim(),
          password: form.password,
          options: {
            data: { name: form.name.trim(), phone: form.phone.trim() },
          },
        });
        if (error) throw error;
        if (!data.session)
          setInfo("Check your email to confirm your account, then sign in.");
        else router.push(afterSignIn());
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: form.email.trim(),
          password: form.password,
        });
        if (error) throw error;
        router.push(afterSignIn());
      }
    } catch (e) {
      setError(e.message || "Could not connect. Please try again.");
    } finally {
      busy.current = false;
      setSubmitting(false);
    }
  }
  return (
    <main className="auth-layout">
      <aside className="auth-aside">
        <span className="eyebrow">A PLACE FOR YOUR EVERYDAY</span>
        <h2>
          Good to
          <br />
          have you here.
        </h2>
        <p>
          Your favourite finds. Your saved basket.
          <br />
          Your orders, all in one place.
        </p>
        <span
          style={{
            font: "italic 55px Georgia",
            color: "#c8b580",
            marginTop: 30,
          }}
        >
          Al-Ammar.
        </span>
      </aside>
      <section className="auth-form">
        {mode !== "forgot" && (
          <div className="auth-switch">
            <button
              disabled={submitting}
              className={mode === "login" ? "active" : ""}
              onClick={() => changeMode("login")}
            >
              Sign in
            </button>
            <button
              disabled={submitting}
              className={mode === "signup" ? "active" : ""}
              onClick={() => changeMode("signup")}
            >
              Create account
            </button>
          </div>
        )}
        <h1>
          {mode === "login"
            ? "Welcome back."
            : mode === "signup"
              ? "Make yourself at home."
              : "A fresh start."}
        </h1>
        <p className="muted small">
          {mode === "forgot"
            ? "We’ll email a link to reset your password."
            : "A little closer to your next favourite."}
        </p>
        {!supabase && (
          <div className="inline-error" role="alert">
            Sign-in is temporarily unavailable. Please try again shortly.
          </div>
        )}
        <form onSubmit={submit}>
          {[
            ...(mode === "signup"
              ? [{ key: "name", label: "Full name", auto: "name", max: 120 }]
              : []),
            {
              key: "email",
              label: "Email address",
              type: "email",
              auto: "email",
              max: 254,
            },
            ...(mode === "signup"
              ? [
                  {
                    key: "phone",
                    label: "Phone number",
                    type: "tel",
                    auto: "tel",
                    max: 30,
                  },
                ]
              : []),
            ...(mode !== "forgot"
              ? [
                  {
                    key: "password",
                    label: "Password",
                    type: "password",
                    auto:
                      mode === "signup" ? "new-password" : "current-password",
                    min: mode === "signup" ? 8 : undefined,
                  },
                ]
              : []),
            ...(mode === "signup"
              ? [
                  {
                    key: "confirm",
                    label: "Confirm password",
                    type: "password",
                    auto: "new-password",
                    min: 8,
                  },
                ]
              : []),
          ].map((f) => (
            <label className="form-field" key={f.key}>
              {f.label}
              <input
                className="stx-input"
                name={f.key}
                autoComplete={f.auto}
                type={f.type || "text"}
                value={form[f.key]}
                minLength={f.min}
                maxLength={f.max || 128}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                required
              />
            </label>
          ))}
          {mode === "login" && (
            <button
              type="button"
              className="text-button"
              disabled={submitting}
              onClick={() => changeMode("forgot")}
            >
              Forgot password?
            </button>
          )}
          {error && (
            <div className="inline-error" role="alert">
              {error}
            </div>
          )}
          {info && (
            <div className="info-banner" role="status">
              {info}
            </div>
          )}
          <button
            className="stx-btn stx-btn-primary"
            disabled={submitting || !supabase}
          >
            {submitting
              ? "One moment…"
              : mode === "login"
                ? "Sign in"
                : mode === "signup"
                  ? "Create account"
                  : "Send reset link"}
          </button>
        </form>
        {mode === "forgot" && (
          <button
            className="text-button mt-4"
            onClick={() => changeMode("login")}
          >
            Back to sign in
          </button>
        )}
      </section>
    </main>
  );
}
