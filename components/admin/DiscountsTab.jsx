"use client";
import { useEffect, useState } from "react";
import Icon from "@/components/Icon";
import { formatMoney } from "@/lib/format";

const EMPTY = {
  code: "",
  kind: "percent",
  value: "",
  minOrder: "",
  maxUses: "",
  expires: "",
};

// Discount codes (coupons table). Customers type a code at checkout; the database
// checks it and applies the discount when the order is placed.
export default function DiscountsTab({ supabase, settings, notify }) {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const money = (n) => formatMoney(n, settings.currencySymbol);

  async function load() {
    setLoading(true);
    setLoadError("");
    const { data, error } = await supabase
      .from("coupons")
      .select("*")
      .order("created_at", { ascending: false });
    if (error)
      setLoadError(
        "Could not load discount codes. Please check your connection and retry.",
      );
    else setCoupons(data);
    setLoading(false);
  }
  useEffect(() => {
    load();
    // Once, when the tab opens; the buttons reload after each change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const code = form.code.trim().toUpperCase();
  const value = Number(form.value);
  const valid =
    /^[A-Z0-9-]{3,30}$/.test(code) &&
    value > 0 &&
    (form.kind === "amount" || value <= 90) &&
    (form.minOrder === "" || Number(form.minOrder) >= 0) &&
    (form.maxUses === "" ||
      (Number.isSafeInteger(Number(form.maxUses)) && Number(form.maxUses) > 0));

  async function create(e) {
    e.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    const { error } = await supabase.from("coupons").insert({
      code,
      kind: form.kind,
      value,
      min_order: form.minOrder === "" ? 0 : Number(form.minOrder),
      max_uses: form.maxUses === "" ? null : Number(form.maxUses),
      // The end of the chosen day in Pakistan.
      expires_at: form.expires ? `${form.expires}T23:59:59+05:00` : null,
    });
    setSaving(false);
    if (error) {
      notify(
        error.code === "23505"
          ? "That code already exists."
          : "The code was not saved. Please check the details and try again.",
        "error",
      );
      return;
    }
    notify(`Discount code ${code} created`);
    setForm(EMPTY);
    load();
  }

  async function setActive(c, active) {
    const { error } = await supabase
      .from("coupons")
      .update({ active })
      .eq("code", c.code);
    if (error) notify("The change was not saved. Please try again.", "error");
    else {
      notify(active ? `${c.code} turned on` : `${c.code} turned off`);
      setCoupons((list) =>
        list.map((x) => (x.code === c.code ? { ...x, active } : x)),
      );
    }
  }

  async function remove(c) {
    if (!window.confirm(`Delete the code ${c.code}?`)) return;
    const { error } = await supabase
      .from("coupons")
      .delete()
      .eq("code", c.code);
    if (error) notify("The code was not deleted. Please try again.", "error");
    else {
      notify(`${c.code} deleted`);
      setCoupons((list) => list.filter((x) => x.code !== c.code));
    }
  }

  function status(c) {
    if (!c.active) return "Off";
    if (c.expires_at && new Date(c.expires_at) <= new Date()) return "Expired";
    if (c.max_uses && c.used_count >= c.max_uses) return "Used up";
    return "Active";
  }

  const field = (key, props) => (
    <input
      className="stx-input"
      style={{ marginTop: 4 }}
      value={form[key]}
      onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      {...props}
    />
  );

  return (
    <div>
      <div
        className="stx-display"
        style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: 6 }}
      >
        Discounts
      </div>
      <p style={{ color: "var(--ink-soft)", marginBottom: 18 }}>
        Create a code (for example EID10) and share it with customers. They
        enter it at checkout. For a sale on one product, set its “Old price” in
        Products instead.
      </p>

      <form
        onSubmit={create}
        className="stx-card px-5 py-5"
        style={{ display: "grid", gap: 12, marginBottom: 20 }}
      >
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <label className="stx-label" style={{ flex: "1 1 160px" }}>
            Code
            {field("code", {
              placeholder: "EID10",
              maxLength: 30,
              autoCapitalize: "characters",
              required: true,
            })}
          </label>
          <label className="stx-label" style={{ flex: "1 1 160px" }}>
            Type
            <select
              className="stx-input"
              style={{ marginTop: 4 }}
              value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value })}
            >
              <option value="percent">Percent off (%)</option>
              <option value="amount">
                Amount off ({settings.currencySymbol})
              </option>
            </select>
          </label>
          <label className="stx-label" style={{ flex: "1 1 120px" }}>
            {form.kind === "percent" ? "Percent (1–90)" : "Amount"}
            {field("value", {
              type: "number",
              min: 1,
              max: form.kind === "percent" ? 90 : undefined,
              step: "1",
              required: true,
            })}
          </label>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <label className="stx-label" style={{ flex: "1 1 160px" }}>
            Minimum order (optional)
            {field("minOrder", { type: "number", min: 0, step: "1" })}
          </label>
          <label className="stx-label" style={{ flex: "1 1 160px" }}>
            How many times (optional)
            {field("maxUses", {
              type: "number",
              min: 1,
              step: "1",
              placeholder: "No limit",
            })}
          </label>
          <label className="stx-label" style={{ flex: "1 1 160px" }}>
            Last day (optional)
            {field("expires", { type: "date" })}
          </label>
        </div>
        <button
          className="stx-btn stx-btn-primary"
          disabled={!valid || saving}
          style={{ justifySelf: "start" }}
        >
          <Icon name="add" size={17} /> {saving ? "Saving…" : "Create code"}
        </button>
      </form>

      {loading ? (
        <p role="status">Loading codes…</p>
      ) : loadError ? (
        <div className="inline-error" role="alert">
          {loadError} <button onClick={load}>Retry</button>
        </div>
      ) : coupons.length === 0 ? (
        <div className="stx-card px-6 py-12 text-center">
          <Icon name="sell" size={28} color="var(--ink-soft)" />
          <p style={{ color: "var(--ink-soft)", marginTop: 10 }}>
            No discount codes yet.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {coupons.map((c) => (
            <div
              key={c.code}
              className="stx-card px-4 py-3"
              style={{
                display: "flex",
                gap: 12,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <div style={{ flex: "1 1 220px" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <strong className="stx-mono">{c.code}</strong>
                  <span
                    style={{
                      fontSize: ".72rem",
                      fontWeight: 700,
                      color:
                        status(c) === "Active"
                          ? "var(--primary)"
                          : "var(--ink-soft)",
                    }}
                  >
                    {status(c)}
                  </span>
                </div>
                <div style={{ fontSize: ".8rem", color: "var(--ink-soft)" }}>
                  {c.kind === "percent"
                    ? `${Number(c.value)}% off`
                    : `${money(c.value)} off`}
                  {Number(c.min_order) > 0 &&
                    ` · orders over ${money(c.min_order)}`}
                  {` · used ${c.used_count}${c.max_uses ? ` of ${c.max_uses}` : ""}`}
                  {c.expires_at &&
                    ` · until ${new Date(c.expires_at).toLocaleDateString(
                      "en-GB",
                      { timeZone: "Asia/Karachi" },
                    )}`}
                </div>
              </div>
              <button
                type="button"
                className="stx-btn stx-btn-outline px-3 py-2"
                onClick={() => setActive(c, !c.active)}
              >
                {c.active ? "Turn off" : "Turn on"}
              </button>
              <button
                type="button"
                className="stx-btn stx-btn-outline px-3 py-2"
                aria-label={`Delete ${c.code}`}
                onClick={() => remove(c)}
                style={{ color: "var(--danger)" }}
              >
                <Icon name="delete" size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
