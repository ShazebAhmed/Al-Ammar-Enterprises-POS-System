"use client";
import { useState } from "react";
import Icon from "@/components/Icon";

export default function SettingsTab({ settings, onSave }) {
  const [form, setForm] = useState({ ...settings });
  const [newCategory, setNewCategory] = useState("");
  const [saveStatus, setSaveStatus] = useState(null); // null | "saving" | "saved" | "error"

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }
  async function saveGeneral(e) {
    e.preventDefault();
    setSaveStatus("saving");
    try {
      await onSave(form);
      setSaveStatus("saved");
    } catch (err) {
      console.error(err);
      setSaveStatus("error");
    }
    setTimeout(() => setSaveStatus(null), 2500);
  }
  function addCategory() {
    const c = newCategory.trim();
    if (!c || form.categories.some((x) => x.toLowerCase() === c.toLowerCase()))
      return;
    set("categories", [...form.categories, c]);
    setNewCategory("");
  }
  function removeCategory(c) {
    set(
      "categories",
      form.categories.filter((x) => x !== c),
    );
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 18,
        }}
      >
        <div
          className="stx-display"
          style={{ fontSize: "1.4rem", fontWeight: 700 }}
        >
          Settings
        </div>
      </div>

      <form
        onSubmit={saveGeneral}
        className="stx-card px-5 py-5"
        style={{ display: "flex", flexDirection: "column", gap: 14 }}
      >
        <div className="stx-label">Store identity</div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <label
            style={{
              flex: "1 1 200px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
            }}
          >
            <span className="stx-label">Store name</span>
            <input
              className="stx-input"
              style={{ marginTop: 4 }}
              value={form.storeName}
              onChange={(e) => set("storeName", e.target.value)}
              placeholder="e.g. Al-Karam General Store"
            />
          </label>
          <label
            style={{
              flex: "1 1 200px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
            }}
          >
            <span className="stx-label">Tagline</span>
            <input
              className="stx-input"
              style={{ marginTop: 4 }}
              value={form.tagline}
              onChange={(e) => set("tagline", e.target.value)}
              placeholder="A short line under your name"
            />
          </label>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <label
            style={{
              flex: "1 1 140px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
            }}
          >
            <span className="stx-label">Logo letter</span>
            <input
              className="stx-input"
              style={{ marginTop: 4 }}
              maxLength={2}
              value={form.logoInitial}
              onChange={(e) => set("logoInitial", e.target.value)}
              placeholder="Auto from store name"
            />
          </label>
          <label
            style={{
              flex: "1 1 140px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
            }}
          >
            <span className="stx-label">Currency symbol</span>
            <input
              className="stx-input"
              style={{ marginTop: 4 }}
              value={form.currencySymbol}
              onChange={(e) => set("currencySymbol", e.target.value)}
            />
          </label>
          <label
            style={{
              flex: "1 1 140px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
            }}
          >
            <span className="stx-label">Shipping fee</span>
            <input
              type="number"
              min="0"
              className="stx-input"
              style={{ marginTop: 4 }}
              value={form.shippingFee}
              onChange={(e) => set("shippingFee", e.target.value)}
            />
          </label>
          <label
            style={{
              flex: "1 1 140px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
            }}
          >
            <span className="stx-label">Free delivery over (0 = off)</span>
            <input
              type="number"
              min="0"
              className="stx-input"
              style={{ marginTop: 4 }}
              value={form.freeDeliveryOver ?? 0}
              onChange={(e) => set("freeDeliveryOver", e.target.value)}
            />
          </label>
        </div>

        <div className="stx-label" style={{ marginTop: 6 }}>
          Contact
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <label
            style={{
              flex: "1 1 200px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
            }}
          >
            <span className="stx-label">Phone number</span>
            <input
              className="stx-input"
              style={{ marginTop: 4 }}
              value={form.contactPhone}
              onChange={(e) => set("contactPhone", e.target.value)}
              placeholder="03xx-xxxxxxx"
            />
          </label>
          <label
            style={{
              flex: "1 1 200px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
            }}
          >
            <span className="stx-label">WhatsApp number</span>
            <input
              className="stx-input"
              style={{ marginTop: 4 }}
              value={form.whatsapp}
              onChange={(e) => set("whatsapp", e.target.value)}
              placeholder="03xx-xxxxxxx"
            />
          </label>
        </div>
        <label style={{ display: "block" }}>
          <span className="stx-label">About your store</span>
          <textarea
            className="stx-input"
            rows={3}
            style={{ marginTop: 4 }}
            value={form.aboutText}
            onChange={(e) => set("aboutText", e.target.value)}
          />
        </label>

        <div>
          <div className="stx-label" style={{ marginBottom: 8 }}>
            Categories
          </div>
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              marginBottom: 8,
            }}
          >
            {form.categories.map((c) => (
              <span
                key={c}
                className="stall-tag"
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                {c}
                <button
                  type="button"
                  aria-label={`Remove the ${c} category`}
                  onClick={() => removeCategory(c)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--brick)",
                    display: "grid",
                    placeItems: "center",
                    minWidth: 28,
                    minHeight: 28,
                    margin: "-6px -8px -6px -4px",
                    padding: 0,
                  }}
                >
                  <Icon name="close" size={14} />
                </button>
              </span>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              className="stx-input"
              aria-label="New category name"
              placeholder="New category name"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              style={{ maxWidth: 220 }}
            />
            <button
              type="button"
              onClick={addCategory}
              className="stx-btn stx-btn-outline"
              style={{ padding: "0 14px" }}
            >
              Add
            </button>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            type="submit"
            disabled={saveStatus === "saving"}
            className="stx-btn stx-btn-primary px-5 py-2.5"
            style={{ width: "fit-content" }}
          >
            {saveStatus === "saving" ? "Saving…" : "Save changes"}
          </button>
          {saveStatus === "saved" && (
            <span
              style={{
                color: "var(--primary)",
                fontSize: ".85rem",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Icon name="check" size={16} /> Saved
            </span>
          )}
          {saveStatus === "error" && (
            <span
              style={{
                color: "var(--danger)",
                fontSize: ".85rem",
                fontWeight: 600,
              }}
            >
              Couldn’t save — check your connection and try again.
            </span>
          )}
        </div>
      </form>

      <div className="stx-card px-5 py-5" style={{ marginTop: 20 }}>
        <div
          className="stx-label"
          style={{
            marginBottom: 10,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Icon name="account_balance_wallet" size={15} /> Online payment
          gateway
        </div>
        <p
          style={{
            fontSize: ".85rem",
            color: "var(--ink-soft)",
            marginBottom: 14,
          }}
        >
          Right now customers pay by cash on delivery or a phone-confirmed
          order. When you’re ready to accept cards, JazzCash or EasyPaisa
          online, you’ll need a merchant account with that provider first.
        </p>
        <span className="badge-soon">Coming soon</span>
      </div>
    </div>
  );
}
