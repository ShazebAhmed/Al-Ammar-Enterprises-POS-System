"use client";
import { useEffect, useState } from "react";
import Icon from "./Icon";
import { pushErrorMessage, pushSupported } from "@/lib/push";

// A button that turns on phone/browser notifications. `enable` does the work
// (watchNewOrders or watchOrder); `done` is shown once it succeeded.
export default function NotifyButton({ label, done, enable, className }) {
  const [state, setState] = useState("idle");
  const [error, setError] = useState("");
  useEffect(() => {
    if (!pushSupported()) setState("unsupported");
  }, []);
  if (state === "unsupported") return null;
  if (state === "on")
    return (
      <p className="notify-done" role="status">
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
