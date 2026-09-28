"use client";
import { useState } from "react";
import Icon from "./Icon";

// Opens the phone's share sheet (WhatsApp, Messenger, …); on a computer it copies
// the product link instead.
export default function ShareButton({ title }) {
  const [copied, setCopied] = useState(false);
  async function share() {
    const url = window.location.href.split("#")[0];
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {}
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {}
  }
  return (
    <button type="button" className="share-button" onClick={share}>
      <Icon name={copied ? "check" : "share"} size={17} />
      <span aria-live="polite">{copied ? "Link copied" : "Share"}</span>
    </button>
  );
}
