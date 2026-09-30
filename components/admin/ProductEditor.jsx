"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Icon from "@/components/Icon";
import PhotoUploader from "@/components/admin/PhotoUploader";
import { formatMoney } from "@/lib/format";
import {
  COLOR_NAME_MAX,
  DEFAULT_SIZE_LABEL,
  MAX_OPTIONS,
  SIZE_NAME_MAX,
  editorOptions,
  newColor,
  newSize,
  optionProblems,
  productOptionFields,
  stockRows,
} from "@/lib/productOptions";

const MAX_MAIN_PHOTOS = 10;
const MAX_COLOR_PHOTOS = 6;
const COLOUR_IDEAS = [
  "Black",
  "Brown",
  "Tan",
  "White",
  "Grey",
  "Blue",
  "Navy",
  "Red",
  "Green",
  "Pink",
  "Gold",
  "Silver",
];
const SIZE_SETS = [
  ["S", "M", "L", "XL"],
  ["Small", "Medium", "Large"],
  ["28", "30", "32", "34", "36"],
];
const SIZE_LABELS = ["Size", "Length", "Pack", "Weight"];

function startingForm(product, categories) {
  return {
    id: product.id || null,
    name: product.name || "",
    category: product.category || categories[0] || "",
    description: product.description || "",
    price: product.price ?? "",
    compareAtPrice: product.compareAtPrice ?? "",
    cost: product.cost ?? "",
    videoUrl: product.videoUrl || "",
    ...editorOptions(product),
  };
}
const money = (value) =>
  value !== "" && Number.isFinite(Number(value)) && Number(value) >= 0;

// The full-page editor for adding or changing a product. Sections run in the
// order a product is put together: details, price, main photos, colours (each
// with its own photos), sizes, stock and video. The summary beside them shows
// what customers will see and what is still missing.
export default function ProductEditor({
  product,
  categories,
  currencySymbol,
  onClose,
  onSave,
  onUploadImage,
  onDiscardImages,
  onDirtyChange,
}) {
  const isNew = !product.id;
  const [form, setForm] = useState(() => startingForm(product, categories));
  const [baseline, setBaseline] = useState(() => JSON.stringify(form));
  const [pending, setPending] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [savedNotice, setSavedNotice] = useState("");
  const [keepDetails, setKeepDetails] = useState(true);
  const [sizeDraft, setSizeDraft] = useState("");
  const [pickFor, setPickFor] = useState(null);
  const [fillValue, setFillValue] = useState("");
  const [focusKey, setFocusKey] = useState(null);
  const nameRef = useRef(null);
  const topRef = useRef(null);
  const checksRef = useRef(null);
  // Photos uploaded in this editor that no saved product uses yet: removed if
  // the editor closes without saving.
  const unsaved = useRef(new Set());
  const discardRef = useRef(onDiscardImages);
  discardRef.current = onDiscardImages;

  const dirty = JSON.stringify(form) !== baseline;
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => {
    nameRef.current?.focus();
    const leftover = unsaved.current;
    return () => {
      if (leftover.size) discardRef.current([...leftover]);
      leftover.clear();
    };
  }, []);
  useEffect(() => {
    if (!focusKey) return;
    document.getElementById(focusKey)?.focus();
    setFocusKey(null);
  }, [focusKey]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const uploading = Object.values(pending).some(Boolean);
  const pendingFor = (key) => (n) =>
    setPending((p) => (p[key] === n ? p : { ...p, [key]: n }));
  const uploadProps = {
    onUpload: onUploadImage,
    onUploaded: (url) => unsaved.current.add(url),
    onRemove: (url) => {
      if (unsaved.current.delete(url)) discardRef.current([url]);
    },
    disabled: saving,
  };

  // ------------------------------------------------------------ colours
  function addColor(name = "") {
    const color = newColor(name);
    setForm((f) => ({ ...f, colors: [...f.colors, color] }));
    if (!name) setFocusKey(`color-name-${color.key}`);
  }
  function updateColor(key, patch) {
    setForm((f) => ({
      ...f,
      colors: f.colors.map((c) => (c.key === key ? { ...c, ...patch } : c)),
    }));
  }
  function colorPhotos(key) {
    return (update) =>
      setForm((f) => ({
        ...f,
        colors: f.colors.map((c) =>
          c.key === key ? { ...c, images: update(c.images) } : c,
        ),
      }));
  }
  function removeColor(color) {
    const photos = color.images.length;
    if (
      photos &&
      !window.confirm(
        `Remove ${color.name.trim() || "this colour"} and its ${photos} ${photos === 1 ? "photo" : "photos"}?`,
      )
    )
      return;
    const fresh = color.images.filter((url) => unsaved.current.delete(url));
    if (fresh.length) discardRef.current(fresh);
    if (pickFor === color.key) setPickFor(null);
    setForm((f) => ({
      ...f,
      colors: f.colors.filter((c) => c.key !== color.key),
    }));
  }
  // Moves one of the main photos to a colour, so it is shown only for it.
  function moveToColor(url, key) {
    setForm((f) => ({
      ...f,
      photos: f.photos.filter((u) => u !== url),
      colors: f.colors.map((c) =>
        c.key === key ? { ...c, images: [...c.images, url] } : c,
      ),
    }));
  }

  // -------------------------------------------------------------- sizes
  function addSizes(text) {
    const names = String(text)
      .split(",")
      .map((s) => s.trim().slice(0, SIZE_NAME_MAX))
      .filter(Boolean);
    if (!names.length) return;
    setForm((f) => {
      const taken = new Set(f.sizes.map((s) => s.name.trim().toLowerCase()));
      const added = [];
      for (const name of names)
        if (!taken.has(name.toLowerCase())) {
          taken.add(name.toLowerCase());
          added.push(newSize(name));
        }
      return { ...f, sizes: [...f.sizes, ...added] };
    });
    setSizeDraft("");
  }
  function removeSize(key) {
    setForm((f) => ({ ...f, sizes: f.sizes.filter((s) => s.key !== key) }));
  }

  // -------------------------------------------------------------- stock
  const rows = stockRows(form);
  const hasOptions = rows.length > 0;
  const setStock = (key, value) =>
    setForm((f) => ({ ...f, stock: { ...f.stock, [key]: value } }));
  function fillStock() {
    if (fillValue === "") return;
    setForm((f) => {
      const stock = { ...f.stock };
      for (const row of stockRows(f)) stock[row.key] = fillValue;
      return { ...f, stock };
    });
  }

  // ------------------------------------------------------------- checks
  const fields = useMemo(() => productOptionFields(form), [form]);
  const problems = [];
  if (!form.name.trim()) problems.push("Enter the product name.");
  if (!form.category)
    problems.push(
      categories.length
        ? "Choose a category."
        : "Add a category in Settings → Categories first.",
    );
  if (!money(form.price)) problems.push("Enter a price of 0 or more.");
  if (form.compareAtPrice !== "" && !money(form.compareAtPrice))
    problems.push("The old price must be a number of 0 or more.");
  if (form.cost !== "" && !money(form.cost))
    problems.push("The cost price must be a number of 0 or more.");
  problems.push(...optionProblems(form));
  if (uploading)
    problems.push(
      "Wait for photos to finish uploading, or remove any that failed.",
    );
  const cover = fields.images[0];
  const sale =
    money(form.compareAtPrice) &&
    money(form.price) &&
    Number(form.compareAtPrice) > Number(form.price)
      ? Math.round((1 - Number(form.price) / Number(form.compareAtPrice)) * 100)
      : 0;
  const profit =
    money(form.cost) && money(form.price)
      ? Number(form.price) - Number(form.cost)
      : null;
  const colorsWithoutPhotos = form.colors.filter(
    (c) => c.name.trim() && !c.images.length,
  );

  async function save(addAnother) {
    if (problems.length || saving) return;
    const submitted = {
      id: form.id,
      name: form.name.trim(),
      category: form.category,
      description: form.description,
      price: Number(form.price),
      compareAtPrice:
        form.compareAtPrice === "" ? null : Number(form.compareAtPrice),
      cost: form.cost === "" ? null : Number(form.cost),
      videoUrl: form.videoUrl.trim(),
      ...fields,
    };
    setSaving(true);
    setSaveError("");
    setSavedNotice("");
    try {
      await onSave(submitted, { addAnother });
      // Photos that are no longer used: new uploads left out of the product,
      // and saved photos that were removed.
      const unused = [
        ...[...unsaved.current],
        ...(product.images || []),
      ].filter((url) => !submitted.images.includes(url));
      unsaved.current.clear();
      if (unused.length) discardRef.current([...new Set(unused)]);
      if (!addAnother) {
        setBaseline(JSON.stringify(form));
        onClose();
        return;
      }
      const next = startingForm({}, categories);
      if (keepDetails)
        Object.assign(next, {
          category: form.category,
          description: form.description,
          price: form.price,
          compareAtPrice: form.compareAtPrice,
          cost: form.cost,
          // Colour and size names carry over; photos and stock start empty.
          colors: form.colors.map((c) => newColor(c.name)),
          sizes: form.sizes.map((s) => newSize(s.name)),
          sizeLabel: form.sizeLabel,
        });
      setForm(next);
      setBaseline(JSON.stringify(next));
      setPickFor(null);
      setSavedNotice(`Saved “${submitted.name}”. Ready for the next product.`);
      topRef.current?.scrollIntoView({ block: "start" });
      nameRef.current?.focus();
    } catch {
      setSaveError(
        "Couldn't save this product. Everything you entered is still here; check your connection and try again.",
      );
    } finally {
      setSaving(false);
    }
  }
  function close() {
    if (dirty && !window.confirm("Leave without saving your changes?")) return;
    onClose();
  }

  const title = isNew
    ? "Add a product"
    : `Edit ${product.name?.trim() || "product"}`;

  return (
    <form
      className="pe"
      ref={topRef}
      onSubmit={(e) => {
        e.preventDefault();
        save(false);
      }}
      // Enter in a text box should not save half a product.
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target.tagName === "INPUT")
          e.preventDefault();
      }}
    >
      <header className="pe-bar">
        <button
          type="button"
          className="pe-back"
          onClick={close}
          disabled={saving}
        >
          <Icon name="chevron_left" size={18} /> Products
        </button>
        <div className="pe-bar-title">
          <h1>{title}</h1>
          {dirty && <span className="pe-dirty">Unsaved changes</span>}
          {problems.length > 0 && !saving && (
            <button
              type="button"
              className="pe-fix"
              onClick={() =>
                checksRef.current?.scrollIntoView({
                  behavior: "smooth",
                  block: "center",
                })
              }
            >
              {problems.length} {problems.length === 1 ? "thing" : "things"} to
              fix before saving
            </button>
          )}
        </div>
        <div className="pe-bar-actions">
          {isNew && (
            <button
              type="button"
              className="stx-btn stx-btn-outline"
              disabled={saving || problems.length > 0}
              onClick={() => save(true)}
            >
              Save &amp; add another
            </button>
          )}
          <button
            type="submit"
            className="stx-btn stx-btn-primary"
            disabled={saving || problems.length > 0}
          >
            {saving ? "Saving…" : isNew ? "Save product" : "Save changes"}
          </button>
        </div>
      </header>

      {savedNotice && (
        <p className="pe-notice" role="status">
          <Icon name="check" size={16} /> {savedNotice}
        </p>
      )}
      {saveError && (
        <p className="pe-notice pe-notice-error" role="alert">
          {saveError}
        </p>
      )}

      <div className="pe-grid">
        <fieldset className="pe-main" disabled={saving}>
          {/* ------------------------------------------------ details */}
          <section className="pe-card" aria-labelledby="pe-details">
            <h2 id="pe-details">Product details</h2>
            <label className="pe-field">
              <span>Product name</span>
              <input
                ref={nameRef}
                className="stx-input"
                value={form.name}
                maxLength={120}
                placeholder="e.g. EvoGrip Men's Leather Wallet"
                onChange={(e) => set({ name: e.target.value })}
              />
            </label>
            <label className="pe-field">
              <span>Category</span>
              <select
                className="stx-input"
                value={form.category}
                onChange={(e) => set({ category: e.target.value })}
              >
                {!categories.includes(form.category) && (
                  <option value={form.category}>
                    {form.category || "Choose a category"}
                  </option>
                )}
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <small>New categories are added in Settings → Categories.</small>
            </label>
            <label className="pe-field">
              <span>Description</span>
              <textarea
                className="stx-input"
                rows={5}
                value={form.description}
                placeholder="What it is made of, its size, what makes it special. The first paragraph shows next to the price."
                onChange={(e) => set({ description: e.target.value })}
              />
            </label>
          </section>

          {/* -------------------------------------------------- price */}
          <section className="pe-card" aria-labelledby="pe-price">
            <h2 id="pe-price">Price</h2>
            <div className="pe-row">
              <label className="pe-field">
                <span>Price</span>
                <input
                  className="stx-input"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => set({ price: e.target.value })}
                />
              </label>
              <label className="pe-field">
                <span>
                  Old price <em>optional</em>
                </span>
                <input
                  className="stx-input"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  placeholder="Only for a sale"
                  value={form.compareAtPrice}
                  onChange={(e) => set({ compareAtPrice: e.target.value })}
                />
                <small>
                  {sale
                    ? `Shown struck through: ${sale}% off.`
                    : "Shown struck through when it is higher than the price."}
                </small>
              </label>
              <label className="pe-field">
                <span>
                  Cost price <em>only you see this</em>
                </span>
                <input
                  className="stx-input"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  placeholder="What you pay for one"
                  value={form.cost}
                  onChange={(e) => set({ cost: e.target.value })}
                />
                {profit !== null && (
                  <small className={profit < 0 ? "pe-bad" : ""}>
                    {profit < 0 ? "Loss" : "Profit"} per item:{" "}
                    {formatMoney(Math.abs(profit), currencySymbol)}
                  </small>
                )}
              </label>
            </div>
          </section>

          {/* ------------------------------------------------- photos */}
          <section className="pe-card" aria-labelledby="pe-photos">
            <h2 id="pe-photos">Main photos</h2>
            <p className="pe-help">
              Shown for the product as a whole. The first one is the cover on
              the shop page.
              {form.colors.length > 0 &&
                " Photos of a particular colour go in that colour below, so each colour shows only its own photos."}
            </p>
            <PhotoUploader
              {...uploadProps}
              label="Main photos"
              photos={form.photos}
              onChange={(update) =>
                setForm((f) => ({ ...f, photos: update(f.photos) }))
              }
              max={MAX_MAIN_PHOTOS}
              coverBadge
              onPendingChange={pendingFor("main")}
              emptyHint={
                form.colors.some((c) => c.images.length)
                  ? "No main photos: the first colour's first photo is the cover."
                  : "Tip: select several photos at once, or drag them here."
              }
            />
          </section>

          {/* ------------------------------------------------ colours */}
          <section className="pe-card" aria-labelledby="pe-colours">
            <h2 id="pe-colours">
              Colours <em>optional</em>
            </h2>
            <p className="pe-help">
              Does it come in different colours? Add each one with its own
              photos. Customers pick a colour and see only its photos.
            </p>
            <div className="pe-colours">
              {form.colors.map((color, i) => {
                const name = color.name.trim() || `Colour ${i + 1}`;
                return (
                  <div className="pe-colour" key={color.key}>
                    <div className="pe-colour-head">
                      <span className="pe-swatch" aria-hidden="true">
                        {color.images[0] ? (
                          <img src={color.images[0]} alt="" />
                        ) : (
                          <Icon name="sell" size={16} />
                        )}
                      </span>
                      <label className="pe-colour-name">
                        <span className="sr-only">Colour {i + 1} name</span>
                        <input
                          id={`color-name-${color.key}`}
                          className="stx-input"
                          value={color.name}
                          maxLength={COLOR_NAME_MAX}
                          placeholder="Colour name, e.g. Black"
                          onChange={(e) =>
                            updateColor(color.key, { name: e.target.value })
                          }
                        />
                      </label>
                      <button
                        type="button"
                        className="pe-icon-btn"
                        aria-label={`Remove ${name}`}
                        onClick={() => removeColor(color)}
                      >
                        <Icon name="delete" size={18} />
                      </button>
                    </div>
                    <PhotoUploader
                      {...uploadProps}
                      label={`${name} photos`}
                      photos={color.images}
                      onChange={colorPhotos(color.key)}
                      max={MAX_COLOR_PHOTOS}
                      addText={`Add ${color.name.trim() || "colour"} photos`}
                      onPendingChange={pendingFor(color.key)}
                    />
                    {form.photos.length > 0 &&
                      color.images.length < MAX_COLOR_PHOTOS && (
                        <div className="pe-pick">
                          <button
                            type="button"
                            className="pe-link"
                            aria-expanded={pickFor === color.key}
                            onClick={() =>
                              setPickFor(
                                pickFor === color.key ? null : color.key,
                              )
                            }
                          >
                            {pickFor === color.key
                              ? "Done"
                              : "Or move one of the main photos here"}
                          </button>
                          {pickFor === color.key && (
                            <div className="pe-pick-grid">
                              {form.photos.map((url, n) => (
                                <button
                                  type="button"
                                  key={url}
                                  aria-label={`Move main photo ${n + 1} to ${name}`}
                                  onClick={() => moveToColor(url, color.key)}
                                >
                                  <img src={url} alt="" />
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                  </div>
                );
              })}
            </div>
            <div className="pe-add-row">
              <button
                type="button"
                className="stx-btn stx-btn-outline"
                onClick={() => addColor()}
              >
                <Icon name="add" size={16} />{" "}
                {form.colors.length ? "Add another colour" : "Add a colour"}
              </button>
              <div className="pe-chips" aria-label="Quick add a colour">
                {COLOUR_IDEAS.filter(
                  (idea) =>
                    !form.colors.some(
                      (c) => c.name.trim().toLowerCase() === idea.toLowerCase(),
                    ),
                )
                  .slice(0, 8)
                  .map((idea) => (
                    <button
                      type="button"
                      key={idea}
                      className="pe-chip"
                      onClick={() => addColor(idea)}
                    >
                      + {idea}
                    </button>
                  ))}
              </div>
            </div>
          </section>

          {/* -------------------------------------------------- sizes */}
          <section className="pe-card" aria-labelledby="pe-sizes">
            <h2 id="pe-sizes">
              Sizes <em>optional</em>
            </h2>
            <p className="pe-help">
              Does it come in sizes, lengths or pack sizes? Add each one.
              {form.colors.length > 0 &&
                " Every colour comes in every size; set each one's stock below."}
            </p>
            {form.sizes.length > 0 && (
              <>
                <ul className="pe-size-list" aria-label="Sizes">
                  {form.sizes.map((s, i) => (
                    <li key={s.key} className="pe-size">
                      <input
                        className="pe-size-input"
                        aria-label={`Size ${i + 1}`}
                        value={s.name}
                        maxLength={SIZE_NAME_MAX}
                        size={Math.max(2, s.name.length)}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            sizes: f.sizes.map((x) =>
                              x.key === s.key
                                ? { ...x, name: e.target.value }
                                : x,
                            ),
                          }))
                        }
                      />
                      <button
                        type="button"
                        aria-label={`Remove size ${s.name || i + 1}`}
                        onClick={() => removeSize(s.key)}
                      >
                        <Icon name="close" size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="pe-size-label">
                  <span>Customers choose a</span>
                  {SIZE_LABELS.map((l) => (
                    <button
                      type="button"
                      key={l}
                      className={`pe-chip${form.sizeLabel === l ? " is-on" : ""}`}
                      aria-pressed={form.sizeLabel === l}
                      onClick={() => set({ sizeLabel: l })}
                    >
                      {l}
                    </button>
                  ))}
                  <input
                    className="stx-input pe-size-label-input"
                    aria-label="Or type what the sizes are called"
                    maxLength={16}
                    value={form.sizeLabel}
                    placeholder={DEFAULT_SIZE_LABEL}
                    onChange={(e) => set({ sizeLabel: e.target.value })}
                  />
                </div>
              </>
            )}
            <div className="pe-add-row">
              <div className="pe-size-add">
                <input
                  className="stx-input"
                  aria-label="New size"
                  placeholder={
                    form.sizes.length ? "Another size" : "e.g. M, or S, M, L"
                  }
                  value={sizeDraft}
                  maxLength={60}
                  onChange={(e) => setSizeDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addSizes(sizeDraft);
                  }}
                />
                <button
                  type="button"
                  className="stx-btn stx-btn-outline"
                  disabled={!sizeDraft.trim()}
                  onClick={() => addSizes(sizeDraft)}
                >
                  <Icon name="add" size={16} /> Add
                </button>
              </div>
              {form.sizes.length === 0 && (
                <div className="pe-chips" aria-label="Common size sets">
                  {SIZE_SETS.map((sizes) => (
                    <button
                      type="button"
                      key={sizes.join()}
                      className="pe-chip"
                      onClick={() => addSizes(sizes.join(","))}
                    >
                      + {sizes.join(" · ")}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* -------------------------------------------------- stock */}
          <section className="pe-card" aria-labelledby="pe-stock">
            <h2 id="pe-stock">Stock</h2>
            {!hasOptions ? (
              <label className="pe-field pe-narrow">
                <span>How many do you have?</span>
                <input
                  className="stx-input"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  placeholder="0"
                  value={form.singleStock}
                  onChange={(e) => set({ singleStock: e.target.value })}
                />
              </label>
            ) : (
              <>
                <p className="pe-help">
                  How many of each do you have? Empty boxes count as 0 (sold
                  out).
                </p>
                {form.colors.length > 0 && form.sizes.length > 0 ? (
                  <div className="pe-table-wrap">
                    <table className="pe-table">
                      <thead>
                        <tr>
                          <th scope="col">Colour</th>
                          {form.sizes.map((s) => (
                            <th scope="col" key={s.key}>
                              {s.name.trim() || "—"}
                            </th>
                          ))}
                          <th scope="col">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {form.colors.map((c) => (
                          <tr key={c.key}>
                            <th scope="row">
                              <span className="pe-row-name">
                                {c.images[0] && (
                                  <img src={c.images[0]} alt="" />
                                )}
                                {c.name.trim() || "—"}
                              </span>
                            </th>
                            {form.sizes.map((s) => {
                              const k = `${c.key}|${s.key}`;
                              return (
                                <td key={s.key}>
                                  <input
                                    className="stx-input"
                                    type="number"
                                    inputMode="numeric"
                                    min="0"
                                    step="1"
                                    placeholder="0"
                                    aria-label={`Stock of ${c.name || "colour"} in ${s.name || "size"}`}
                                    value={form.stock[k] ?? ""}
                                    onChange={(e) =>
                                      setStock(k, e.target.value)
                                    }
                                  />
                                </td>
                              );
                            })}
                            <td className="pe-total">
                              {form.sizes.reduce(
                                (sum, s) =>
                                  sum +
                                  (Number(form.stock[`${c.key}|${s.key}`]) ||
                                    0),
                                0,
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <ul className="pe-stock-list">
                    {rows.map((row) => {
                      const name =
                        (row.color || row.size).name.trim() || "Unnamed";
                      return (
                        <li key={row.key}>
                          <span className="pe-row-name">
                            {row.color?.images[0] && (
                              <img src={row.color.images[0]} alt="" />
                            )}
                            {name}
                          </span>
                          <input
                            className="stx-input"
                            type="number"
                            inputMode="numeric"
                            min="0"
                            step="1"
                            placeholder="0"
                            aria-label={`Stock of ${name}`}
                            value={form.stock[row.key] ?? ""}
                            onChange={(e) => setStock(row.key, e.target.value)}
                          />
                        </li>
                      );
                    })}
                  </ul>
                )}
                {rows.length > 1 && (
                  <div className="pe-fill">
                    <span>Same stock for all:</span>
                    <input
                      className="stx-input"
                      type="number"
                      inputMode="numeric"
                      min="0"
                      step="1"
                      aria-label="Stock to put in every box"
                      value={fillValue}
                      onChange={(e) => setFillValue(e.target.value)}
                    />
                    <button
                      type="button"
                      className="stx-btn stx-btn-outline"
                      disabled={fillValue === ""}
                      onClick={fillStock}
                    >
                      Fill every box
                    </button>
                  </div>
                )}
                <p className="pe-total-line">
                  Total stock: <strong>{fields.stock}</strong>
                  {rows.length > MAX_OPTIONS
                    ? ` · ${rows.length} choices (the most is ${MAX_OPTIONS})`
                    : ` · ${rows.length} ${rows.length === 1 ? "choice" : "choices"}`}
                </p>
              </>
            )}
          </section>

          {/* -------------------------------------------------- video */}
          <section className="pe-card" aria-labelledby="pe-video">
            <h2 id="pe-video">
              Video <em>optional</em>
            </h2>
            <label className="pe-field">
              <span>Video link</span>
              <input
                className="stx-input"
                value={form.videoUrl}
                placeholder="YouTube link, or a direct .mp4 link"
                onChange={(e) => set({ videoUrl: e.target.value })}
              />
            </label>
          </section>

          {isNew && (
            <label className="pe-keep">
              <input
                type="checkbox"
                checked={keepDetails}
                onChange={(e) => setKeepDetails(e.target.checked)}
              />
              <span>
                With “Save &amp; add another”, keep the category, prices,
                description, colour names and sizes for the next product. Name,
                photos and stock start empty.
              </span>
            </label>
          )}
        </fieldset>

        {/* ------------------------------------------------- summary */}
        <aside className="pe-side" aria-label="Summary">
          <div className="pe-card pe-preview">
            <h2>How it looks</h2>
            <div className="pe-preview-photo">
              {cover ? (
                <img src={cover} alt="" />
              ) : (
                <Icon name="inventory_2" size={32} color="var(--ink-soft)" />
              )}
            </div>
            <strong className="pe-preview-name">
              {form.name.trim() || "Product name"}
            </strong>
            <span className="pe-preview-price">
              {money(form.price)
                ? formatMoney(Number(form.price), currencySymbol)
                : "Price"}
              {sale > 0 && (
                <s>
                  {formatMoney(Number(form.compareAtPrice), currencySymbol)}
                </s>
              )}
            </span>
            {form.colors.length > 0 && (
              <div className="pe-preview-line">
                <span>Colours</span>
                <div className="pe-preview-swatches">
                  {form.colors.map((c) => (
                    <span key={c.key} title={c.name}>
                      {c.images[0] ? (
                        <img src={c.images[0]} alt={c.name} />
                      ) : (
                        c.name.trim().slice(0, 2) || "?"
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {form.sizes.length > 0 && (
              <div className="pe-preview-line">
                <span>{form.sizeLabel.trim() || DEFAULT_SIZE_LABEL}</span>
                <div className="pe-preview-sizes">
                  {form.sizes.map((s) => (
                    <span key={s.key}>{s.name.trim() || "?"}</span>
                  ))}
                </div>
              </div>
            )}
            <div className="pe-preview-line">
              <span>Stock</span>
              <strong>{fields.stock}</strong>
            </div>
          </div>
          <div className="pe-card pe-checks" ref={checksRef}>
            <h2>{problems.length ? "Before saving" : "Ready to save"}</h2>
            {problems.length > 0 ? (
              <ul className="pe-problems">
                {problems.map((p) => (
                  <li key={p}>
                    <Icon name="warning" size={15} /> {p}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="pe-ok">
                <Icon name="check" size={16} /> Everything needed is filled in.
              </p>
            )}
            <ul className="pe-warnings">
              {!fields.images.length && <li>No photos yet.</li>}
              {colorsWithoutPhotos.length > 0 && (
                <li>
                  No photos for{" "}
                  {colorsWithoutPhotos.map((c) => c.name.trim()).join(", ")}.
                </li>
              )}
              {!problems.length && fields.stock === 0 && (
                <li>Stock is 0, so customers will see “Out of stock”.</li>
              )}
            </ul>
          </div>
        </aside>
      </div>
    </form>
  );
}
