"use client";
import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";
import { pushErrorMessage, pushSupported } from "@/lib/push";

// A button that turns on phone/browser notifications. `enable` does the work
// (watchNewOrders, watchOrder or followMyOrders); `done` is shown once it succeeded.
// When notifications are already allowed (the apps ask when first opened) it turns
// them on by itself, so there is nothing to tap. `onState` hears every change
// ("idle", "working", "on", "iphone", "unsupported").
export default function NotifyButton({
  label,
  done,
  enable,
  className,
  onState,
}) {
  const [state, setState] = useState("idle");
  useEffect(() => {
    onState?.(state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  const [error, setError] = useState("");
  const started = useRef(false);
  useEffect(() => {
    if (!pushSupported()) {
      // iPhone Safari only allows notifications for sites added to the Home Screen.
      setState(
        /iPhone|iPad|iPod/.test(navigator.userAgent) && !navigator.standalone
          ? "iphone"
          : "unsupported",
      );
      return;
    }
    if (Notification.permission !== "granted" || started.current) return;
    started.current = true;
    setState("working");
    enable()
      .then(() => setState("on"))
      // Quietly fall back to the button; tapping it shows what went wrong.
      .catch(() => setState("idle"));
    // Once per page: `enable` is a new function on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (state === "unsupported") return null;
  if (state === "iphone")
    return (
      <p className={`muted small ${className || ""}`}>
        <Icon name="notifications" size={15} /> On iPhone, tap Share, then “Add
        to Home Screen”, and open the store from there to get notifications.
      </p>
    );
  if (state === "on")
    return (
      <p className={`notify-done ${className || ""}`} role="status">
        <Icon name="check" size={16} /> {done}
      </p>
    );
  return (
    <div className={className}>
      <button
        type="button"
        className="stx-btn stx-btn-outline"
        disabled={state === "working"}
        onClick={async () => {
          setState("working");
          setError("");
          try {
            await enable();
            setState("on");
          } catch (e) {
            setError(pushErrorMessage(e));
            setState("idle");
          }
        }}
      >
        <Icon name="notifications" size={17} />{" "}
        {state === "working" ? "Turning on…" : label}
      </button>
      {error && (
        <p className="inline-error" role="alert" style={{ marginTop: 8 }}>
          {error}
        </p>
      )}
    </div>
  );
}
