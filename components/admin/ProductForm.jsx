"use client";
import { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";
import { compressImage, uid } from "@/lib/format";

// Colour photos count towards this too, since each is one of the product's photos.
const MAX_PHOTOS = 10;

// Each option row gets a stable key so an upload started for one option still
// lands on it if rows above are removed while it uploads.
function newOption(v = {}) {
  return {
    key: uid("opt_"),
    name: v.name || "",
    stock: v.stock === undefined ? "" : String(v.stock),
    image: v.image || "",
  };
}

function optionExample(label) {
  if (/colou?r/i.test(label)) return "e.g. Black";
  if (/size/i.test(label)) return "e.g. Medium";
  return "e.g. Medium or Black";
}

export default function ProductForm({
  product,
  categories,
  onCancel,
  onSave,
  onUploadImage,
  onDiscardImages,
}) {
  const isNew = !product.id;
  const [form, setForm] = useState({
    id: product.id || null,
    name: product.name || "",
    category: product.category || categories[0] || "",
    price: product.price ?? "",
    compareAtPrice: product.compareAtPrice ?? "",
    cost: product.cost ?? "",
    stock: product.stock ?? "",
    optionLabel: product.optionLabel || "",
    variants: (product.variants || []).map(newOption),
    description: product.description || "",
    images: product.images || [],
    videoUrl: product.videoUrl || "",
  });
  const [keepDetails, setKeepDetails] = useState(true);
  // The option whose photo picker is open, and the option to focus once added.
  const [pickerFor, setPickerFor] = useState(null);
  const [focusOption, setFocusOption] = useState(null);
  const [uploads, setUploads] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadNotice, setUploadNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [savedNotice, setSavedNotice] = useState("");
  const fileRef = useRef(null),
    optionFileRef = useRef(null),
    pickerOpen = useRef(false),
    nameRef = useRef(null),
    dialogRef = useRef(null);
  const working = useRef(false),
    alive = useRef(true),
    previews = useRef(new Set()),
    // Photos uploaded in this editor that no saved product refers to yet.
    unsaved = useRef(new Set()),
    // Set by the submit buttons' clicks; SubmitEvent.submitter is missing in
    // older Safari, and pressing Enter should save and close.
    addAnotherClicked = useRef(false);
  function cancel() {
    if (working.current) return;
    onDiscardImages([...unsaved.current]);
    unsaved.current.clear();
    onCancel();
  }
  const cancelRef = useRef(cancel);
  cancelRef.current = cancel;
  pickerOpen.current = pickerFor !== null;
  function releasePreview(url) {
    if (url) {
      URL.revokeObjectURL(url);
      previews.current.delete(url);
    }
  }
  useEffect(() => {
    alive.current = true;
    const previous = document.activeElement;
    const node = dialogRef.current;
    const focusable = () =>
      Array.from(
        node.querySelectorAll(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
        ),
      ).filter((el) => el.offsetParent !== null);
    nameRef.current?.focus();
    function keydown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        // Escape closes an open photo picker before the whole editor.
        if (pickerOpen.current) setPickerFor(null);
        else cancelRef.current();
      }
      if (event.key !== "Tab") return;
      const items = focusable(),
        first = items[0],
        last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    node.addEventListener("keydown", keydown);
    const urls = previews.current; // the same Set for the form's lifetime
    return () => {
      alive.current = false;
      node.removeEventListener("keydown", keydown);
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
      previous?.focus();
    };
  }, []);

  async function uploadBatch(entries) {
    if (working.current) return;
    working.current = true;
    setUploading(true);
    setSavedNotice("");
    try {
      for (const entry of entries) {
        if (!alive.current) break;
        setUploads((list) =>
          list.map((item) =>
            item.id === entry.id
              ? { ...item, status: "uploading", error: "" }
              : item,
          ),
        );
        try {
          if (!entry.file.type.startsWith("image/"))
            throw new Error("Choose an image file.");
          if (entry.file.size > 10 * 1024 * 1024)
            throw new Error("Choose an image under 10 MB.");
          const blob = await compressImage(entry.file);
          const url = await onUploadImage(blob);
          unsaved.current.add(url);
          if (!alive.current) break;
          // Keep each successful upload even when a later image fails. A photo
          // uploaded from an option's picker becomes that option's photo.
          setForm((current) => ({
            ...current,
            images: [...current.images, url],
            variants: entry.optionKey
              ? current.variants.map((v) =>
                  v.key === entry.optionKey ? { ...v, image: url } : v,
                )
              : current.variants,
          }));
          setUploads((list) => list.filter((item) => item.id !== entry.id));
          releasePreview(entry.preview);
        } catch (error) {
          if (!alive.current) break;
          const status = Number(error?.statusCode || error?.status);
          const message = error?.message || "";
          const reason = message.startsWith("Choose an image")
            ? message
            : status === 403 ||
                /row.level security|unauthoriz|permission/i.test(message)
              ? "Upload permission denied. Check your admin access, then retry."
              : /bucket.*not found/i.test(message)
                ? "Image storage is unavailable. Check the store's storage setup."
                : "Could not upload this image. Check your connection or try a different image.";
          setUploads((list) =>
            list.map((item) =>
              item.id === entry.id
                ? { ...item, status: "failed", error: reason }
                : item,
            ),
          );
        }
      }
    } finally {
      working.current = false;
      if (alive.current) setUploading(false);
    }
  }
  function handleFiles(event) {
    const selected = Array.from(event.target.files || []);
    event.target.value = "";
    return queueFiles(selected, null);
  }
  function handleOptionFile(event) {
    const selected = Array.from(event.target.files || []).slice(0, 1);
    event.target.value = "";
    const optionKey = pickerFor;
    setPickerFor(null);
    return queueFiles(selected, optionKey);
  }
  async function queueFiles(selected, optionKey) {
    if (working.current || !selected.length) return;
    const slots = Math.max(0, MAX_PHOTOS - form.images.length - uploads.length);
    const files = selected.slice(0, slots);
    setUploadNotice(
      selected.length > slots
        ? `Only ${slots} more ${slots === 1 ? "photo can" : "photos can"} be added. The extra files were not uploaded.`
        : "",
    );
    if (!files.length) return;
    const entries = files.map((file) => {
      const preview =
        file.type.startsWith("image/") && file.size <= 10 * 1024 * 1024
          ? URL.createObjectURL(file)
          : "";
      if (preview) previews.current.add(preview);
      return {
        id: uid("upload_"),
        file,
        preview,
        optionKey,
        status: "queued",
        error: "",
      };
    });
    setUploads((list) => [...list, ...entries]);
    await uploadBatch(entries);
  }
  function removePending(entry) {
    if (working.current) return;
    releasePreview(entry.preview);
    setUploads((list) => list.filter((item) => item.id !== entry.id));
    setUploadNotice("");
  }
  function removeImage(index) {
    if (working.current) return;
    // Photos already saved on the product are deleted only after the product
    // is saved without them, so cancelling keeps them.
    const url = form.images[index];
    if (unsaved.current.delete(url)) onDiscardImages([url]);
    setForm((current) => ({
      ...current,
      images: current.images.filter((_, i) => i !== index),
      variants: current.variants.map((v) =>
        v.image === url ? { ...v, image: "" } : v,
      ),
    }));
    setUploadNotice("");
  }
  function updateOption(key, patch) {
    setForm((current) => ({
      ...current,
      variants: current.variants.map((v) =>
        v.key === key ? { ...v, ...patch } : v,
      ),
    }));
  }
  function addOption(label) {
    const option = newOption();
    setForm((current) => ({
      ...current,
      optionLabel: label ?? current.optionLabel,
      variants: [...current.variants, option],
    }));
    setFocusOption(option.key);
  }
  function removeOption(key) {
    if (pickerFor === key) setPickerFor(null);
    setForm((current) => ({
      ...current,
      variants: current.variants.filter((v) => v.key !== key),
    }));
  }
  useEffect(() => {
    if (!focusOption) return;
    document.getElementById(`option-name-${focusOption}`)?.focus();
    setFocusOption(null);
  }, [focusOption]);
  const photosFull = form.images.length + uploads.length >= MAX_PHOTOS;
  const canSave =
    form.name.trim() &&
    form.category &&
    form.price !== "" &&
    Number.isFinite(Number(form.price)) &&
    Number(form.price) >= 0 &&
    (form.compareAtPrice === "" ||
      (Number.isFinite(Number(form.compareAtPrice)) &&
        Number(form.compareAtPrice) >= 0)) &&
    (form.cost === "" ||
      (Number.isFinite(Number(form.cost)) && Number(form.cost) >= 0)) &&
    (form.variants.length
      ? form.variants.every(
          (v) =>
            v.name.trim() &&
            v.stock !== "" &&
            Number.isSafeInteger(Number(v.stock)) &&
            Number(v.stock) >= 0,
        ) &&
        new Set(form.variants.map((v) => v.name.trim().toLowerCase())).size ===
          form.variants.length
      : form.stock !== "" &&
        Number.isSafeInteger(Number(form.stock)) &&
        Number(form.stock) >= 0) &&
    !uploading &&
    uploads.length === 0;
  async function save(event) {
    event.preventDefault();
    if (!canSave || working.current) return;
    const addAnother = isNew && addAnotherClicked.current;
    addAnotherClicked.current = false;
    const submitted = {
      ...form,
      name: form.name.trim(),
      price: Number(form.price),
      compareAtPrice:
        form.compareAtPrice === "" ? null : Number(form.compareAtPrice),
      cost: form.cost === "" ? null : Number(form.cost),
      stock: form.variants.length
        ? form.variants.reduce((sum, v) => sum + Number(v.stock), 0)
        : Number(form.stock),
      optionLabel: form.variants.length
        ? form.optionLabel.trim() || "Size"
        : "",
      variants: form.variants.map((v) => ({
        name: v.name.trim(),
        stock: Number(v.stock),
        // The option's own photo, if it is still one of the product's photos.
        ...(v.image && form.images.includes(v.image) && { image: v.image }),
      })),
    };
    working.current = true;
    setSaving(true);
    setSaveError("");
    setSavedNotice("");
    try {
      await onSave(submitted, { addAnother });
      unsaved.current.clear();
      const dropped = (product.images || []).filter(
        (url) => !submitted.images.includes(url),
      );
      if (form.id && dropped.length) onDiscardImages(dropped);
      if (addAnother && alive.current) {
        setForm({
          id: null,
          name: "",
          category: keepDetails ? submitted.category : categories[0] || "",
          price: keepDetails ? submitted.price : "",
          compareAtPrice: keepDetails ? (submitted.compareAtPrice ?? "") : "",
          cost: keepDetails ? (submitted.cost ?? "") : "",
          stock: keepDetails ? submitted.stock : "",
          optionLabel: keepDetails ? submitted.optionLabel : "",
          // Photos are cleared, so no option keeps one.
          variants: keepDetails
            ? submitted.variants.map((v) => newOption({ ...v, image: "" }))
            : [],
          description: keepDetails ? submitted.description : "",
          images: [],
          videoUrl: "",
        });
        setUploadNotice("");
        setPickerFor(null);
        setSavedNotice(
          `Saved “${submitted.name}”. Ready for the next product.`,
        );
      }
    } catch {
      if (alive.current)
        setSaveError(
          "Couldn't save this product. Your details and uploaded photos are kept here; check your connection and try again.",
        );
    } finally {
      working.current = false;
      if (alive.current) setSaving(false);
    }
  }
  useEffect(() => {
    if (savedNotice && !saving) nameRef.current?.focus();
  }, [savedNotice, saving]);
  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Product editor"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(20,35,31,.5)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        overflowY: "auto",
        padding: "24px 12px",
        zIndex: 200,
      }}
    >
      <form
        onSubmit={save}
        className="stx-card"
        style={{ width: "min(600px,100%)", padding: 0 }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "16px 20px",
            borderBottom: "1px solid var(--line)",
          }}
        >
          <h2 style={{ fontSize: "1.1rem", margin: 0 }}>
            {isNew ? "Add product" : "Edit product"}
          </h2>
          <button
            type="button"
            aria-label="Close product editor"
            disabled={saving || uploading}
            onClick={cancel}
            className="icon-button"
          >
            <Icon name="close" size={22} />
          </button>
        </div>
        <fieldset
          disabled={saving}
          style={{
            border: 0,
            margin: 0,
            padding: 20,
            display: "flex",
            flexDirection: "column",
            gap: 14,
            maxHeight: "68vh",
            overflowY: "auto",
            minWidth: 0,
          }}
        >
          {savedNotice && (
            <p role="status" style={{ color: "var(--primary)", margin: 0 }}>
              {savedNotice}
            </p>
          )}
          <label className="stx-label" htmlFor="product-name">
            Product name
            <input
              ref={nameRef}
              id="product-name"
              className="stx-input"
              style={{ marginTop: 4 }}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </label>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <label
              className="stx-label"
              style={{ flex: "1 1 160px" }}
              htmlFor="product-price"
            >
              Price
              <input
                id="product-price"
                type="number"
                min="0"
                step="0.01"
                className="stx-input"
                style={{ marginTop: 4 }}
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                required
              />
            </label>
            <label
              className="stx-label"
              style={{ flex: "1 1 160px" }}
              htmlFor="product-compare-price"
            >
              Old price (for a sale)
              <input
                id="product-compare-price"
                type="number"
                min="0"
                step="0.01"
                className="stx-input"
                style={{ marginTop: 4 }}
                placeholder="Leave empty if not on sale"
                value={form.compareAtPrice}
                onChange={(e) =>
                  setForm({ ...form, compareAtPrice: e.target.value })
                }
              />
            </label>
            <label
              className="stx-label"
              style={{ flex: "1 1 160px" }}
              htmlFor="product-cost"
            >
              Cost price (only you see this)
              <input
                id="product-cost"
                type="number"
                min="0"
                step="0.01"
                className="stx-input"
                style={{ marginTop: 4 }}
                placeholder="What you pay for one"
                value={form.cost}
                onChange={(e) => setForm({ ...form, cost: e.target.value })}
              />
            </label>
            <label
              className="stx-label"
              style={{ flex: "1 1 160px" }}
              htmlFor="product-stock"
            >
              Stock quantity
              <input
                id="product-stock"
                type="number"
                min="0"
                step="1"
                className="stx-input"
                style={{ marginTop: 4 }}
                value={
                  form.variants.length
                    ? form.variants.reduce(
                        (sum, v) => sum + (Number(v.stock) || 0),
                        0,
                      )
                    : form.stock
                }
                disabled={form.variants.length > 0}
                title={
                  form.variants.length
                    ? "The total of the options below"
                    : undefined
                }
                onChange={(e) => setForm({ ...form, stock: e.target.value })}
                required={!form.variants.length}
              />
            </label>
          </div>
          <label className="stx-label" htmlFor="product-category">
            Category
            <select
              id="product-category"
              className="stx-input"
              style={{ marginTop: 4 }}
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {!categories.includes(form.category) && (
                <option value={form.category}>
                  {form.category || "Choose a category"}
                </option>
              )}
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
          <small
            style={{
              color: form.category ? "var(--ink-soft)" : "var(--danger)",
            }}
          >
            {categories.length
              ? form.category
                ? "Add new categories in Settings → Categories."
                : "Choose a category to save this product."
              : "Add a category in Settings → Categories before adding products."}
          </small>
          <label className="stx-label" htmlFor="product-description">
            Description
            <textarea
              id="product-description"
              className="stx-input"
              rows={3}
              style={{ marginTop: 4 }}
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </label>
          <section aria-label="Product photos">
            <div className="stx-label">
              Photos ({form.images.length + uploads.length}/{MAX_PHOTOS})
            </div>
            <p
              style={{
                fontSize: ".8rem",
                color: "var(--ink-soft)",
                margin: "6px 0 10px",
              }}
            >
              Select several photos together. Up to 10 MB each. The first
              uploaded photo is the cover. Colour photos can be added here or
              from each colour below.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {form.images.map((url, index) => (
                <div key={url} style={{ width: 100 }}>
                  <img
                    src={url}
                    alt={`Product photo ${index + 1}`}
                    style={{
                      width: 100,
                      height: 90,
                      borderRadius: 8,
                      objectFit: "cover",
                    }}
                  />
                  <PhotoTag
                    cover={index === 0}
                    options={form.variants
                      .filter((v) => v.image === url && v.name.trim())
                      .map((v) => v.name.trim())}
                  />
                  <button
                    type="button"
                    className="text-button"
                    disabled={uploading}
                    aria-label={`Remove photo ${index + 1}`}
                    onClick={() => removeImage(index)}
                  >
                    Remove {index === 0 ? "cover" : "photo"}
                  </button>
                </div>
              ))}
              {uploads.map((entry) => (
                <div
                  key={entry.id}
                  style={{
                    width: 140,
                    overflowWrap: "anywhere",
                    fontSize: ".78rem",
                  }}
                >
                  {entry.preview && (
                    <img
                      src={entry.preview}
                      alt={`Preview of ${entry.file.name}`}
                      style={{
                        width: 100,
                        height: 90,
                        borderRadius: 8,
                        objectFit: "cover",
                      }}
                    />
                  )}
                  <div>{entry.file.name}</div>
                  {entry.error ? (
                    <p
                      role="alert"
                      style={{ color: "var(--danger)", margin: "6px 0" }}
                    >
                      {entry.error}
                    </p>
                  ) : (
                    <p role="status">
                      {entry.status === "uploading" ? "Uploading…" : "Waiting…"}
                    </p>
                  )}
                  <div style={{ display: "flex", gap: 10 }}>
                    {entry.status === "failed" && (
                      <button
                        type="button"
                        disabled={uploading}
                        className="text-button"
                        onClick={() => uploadBatch([entry])}
                      >
                        Retry
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={uploading}
                      className="text-button"
                      aria-label={`Remove ${entry.file.name}`}
                      onClick={() => removePending(entry)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <input
              ref={fileRef}
              aria-label="Choose product photos"
              type="file"
              accept="image/*"
              multiple
              disabled={uploading}
              onChange={handleFiles}
              style={{ display: "none" }}
            />
            <button
              type="button"
              className="stx-btn stx-btn-outline"
              style={{ marginTop: 10 }}
              disabled={uploading || photosFull}
              onClick={() => fileRef.current?.click()}
            >
              <Icon name="upload" size={17} />{" "}
              {uploading ? "Uploading photos…" : "Choose photos"}
            </button>
            {uploadNotice && (
              <p role="status" style={{ fontSize: ".8rem", marginTop: 8 }}>
                {uploadNotice}
              </p>
            )}
            {!uploading && uploads.length > 0 && (
              <p
                style={{
                  fontSize: ".8rem",
                  color: "var(--danger)",
                  marginTop: 8,
                }}
              >
                Retry or remove failed photos before saving.
              </p>
            )}
          </section>
          <fieldset className="options-editor">
            <legend className="stx-label">
              Colours or sizes <span className="muted">optional</span>
            </legend>
            {form.variants.length === 0 ? (
              <>
                <p className="muted small" style={{ margin: 0 }}>
                  Does this product come in different colours or sizes? Each one
                  gets its own stock, and a colour can have its own photo.
                </p>
                <div className="option-start">
                  <button
                    type="button"
                    className="stx-btn stx-btn-outline"
                    onClick={() => addOption("Colour")}
                  >
                    <Icon name="add" size={16} /> Add colours
                  </button>
                  <button
                    type="button"
                    className="stx-btn stx-btn-outline"
                    onClick={() => addOption("Size")}
                  >
                    <Icon name="add" size={16} /> Add sizes
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="option-label-row">
                  <label className="stx-label" htmlFor="product-option-label">
                    Customers choose a
                  </label>
                  <input
                    id="product-option-label"
                    className="stx-input"
                    placeholder="Size"
                    maxLength={40}
                    value={form.optionLabel}
                    onChange={(e) =>
                      setForm({ ...form, optionLabel: e.target.value })
                    }
                  />
                  {["Colour", "Size"].map((label) => (
                    <button
                      key={label}
                      type="button"
                      className={`option-chip${form.optionLabel === label ? " is-on" : ""}`}
                      aria-pressed={form.optionLabel === label}
                      onClick={() => setForm({ ...form, optionLabel: label })}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {form.variants.map((v, i) => {
                  const label = v.name.trim() || `option ${i + 1}`;
                  const open = pickerFor === v.key;
                  const pending = uploads.find(
                    (entry) => entry.optionKey === v.key,
                  );
                  const photo = form.images.includes(v.image) ? v.image : "";
                  return (
                    <div className="option-item" key={v.key}>
                      <div className="option-row">
                        <button
                          type="button"
                          className={`option-photo${open ? " is-open" : ""}`}
                          aria-expanded={open}
                          aria-label={
                            photo
                              ? `Change the photo for ${label}`
                              : `Add a photo for ${label}`
                          }
                          onClick={() => setPickerFor(open ? null : v.key)}
                        >
                          {pending ? (
                            <span className="small">
                              {pending.status === "failed" ? "Failed" : "…"}
                            </span>
                          ) : photo ? (
                            <img src={photo} alt="" />
                          ) : (
                            <>
                              <Icon name="add" size={16} />
                              <span>Photo</span>
                            </>
                          )}
                        </button>
                        <input
                          id={`option-name-${v.key}`}
                          className="stx-input"
                          aria-label={`Option ${i + 1} name`}
                          placeholder={optionExample(form.optionLabel)}
                          maxLength={40}
                          value={v.name}
                          onChange={(e) =>
                            updateOption(v.key, { name: e.target.value })
                          }
                        />
                        <input
                          className="stx-input"
                          type="number"
                          min="0"
                          step="1"
                          aria-label={`Stock for ${label}`}
                          placeholder="Stock"
                          value={v.stock}
                          onChange={(e) =>
                            updateOption(v.key, { stock: e.target.value })
                          }
                        />
                        <button
                          type="button"
                          className="icon-button"
                          aria-label={`Remove ${label}`}
                          onClick={() => removeOption(v.key)}
                        >
                          <Icon name="close" size={16} />
                        </button>
                      </div>
                      {open && (
                        <div
                          className="option-photo-picker"
                          role="group"
                          aria-label={`Photo for ${label}`}
                        >
                          <p className="muted small" style={{ margin: 0 }}>
                            {form.images.length
                              ? `Tap the photo customers should see when they choose ${label}, or upload a new one.`
                              : `Upload the photo customers should see when they choose ${label}.`}
                          </p>
                          <div className="option-photo-grid">
                            {form.images.map((url, n) => (
                              <button
                                type="button"
                                key={url}
                                className={`option-photo-choice${v.image === url ? " is-selected" : ""}`}
                                aria-pressed={v.image === url}
                                aria-label={`Use photo ${n + 1} for ${label}`}
                                onClick={() => {
                                  updateOption(v.key, { image: url });
                                  setPickerFor(null);
                                }}
                              >
                                <img src={url} alt="" />
                                {v.image === url && (
                                  <span className="option-photo-check">
                                    <Icon name="check" size={14} />
                                  </span>
                                )}
                              </button>
                            ))}
                            <button
                              type="button"
                              className="option-photo-choice option-photo-upload"
                              disabled={uploading || photosFull}
                              onClick={() => optionFileRef.current?.click()}
                            >
                              <Icon name="upload" size={18} />
                              <span>Upload new</span>
                            </button>
                          </div>
                          {photosFull && (
                            <p className="muted small" style={{ margin: 0 }}>
                              This product already has {MAX_PHOTOS} photos.
                              Remove one above to upload another.
                            </p>
                          )}
                          <div className="option-picker-actions">
                            {photo && (
                              <button
                                type="button"
                                className="text-button"
                                onClick={() => {
                                  updateOption(v.key, { image: "" });
                                  setPickerFor(null);
                                }}
                              >
                                No photo for {label}
                              </button>
                            )}
                            <button
                              type="button"
                              className="text-button"
                              onClick={() => setPickerFor(null)}
                            >
                              Done
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                <button
                  type="button"
                  className="stx-btn stx-btn-outline"
                  disabled={form.variants.length >= 50}
                  onClick={() => addOption()}
                >
                  <Icon name="add" size={16} /> Add another{" "}
                  {(form.optionLabel.trim() || "option").toLowerCase()}
                </button>
                <p className="muted small" style={{ margin: 0 }}>
                  Stock quantity above is the total of these. Customers choose
                  one before adding to the basket.
                </p>
              </>
            )}
            <input
              ref={optionFileRef}
              aria-label="Choose a photo for this option"
              type="file"
              accept="image/*"
              disabled={uploading}
              onChange={handleOptionFile}
              style={{ display: "none" }}
            />
          </fieldset>
          <label className="stx-label" htmlFor="product-video">
            Video link (optional)
            <input
              id="product-video"
              className="stx-input"
              style={{ marginTop: 4 }}
              placeholder="YouTube link, or a direct .mp4 URL"
              value={form.videoUrl}
              onChange={(e) => setForm({ ...form, videoUrl: e.target.value })}
            />
          </label>
          {isNew && (
            <label
              style={{
                fontSize: ".82rem",
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
              }}
            >
              <input
                type="checkbox"
                checked={keepDetails}
                onChange={(e) => setKeepDetails(e.target.checked)}
              />
              <span>
                Keep category, price, stock and description when adding another
                product. Name, photos and video are cleared.
              </span>
            </label>
          )}
        </fieldset>
        {saveError && (
          <p
            role="alert"
            style={{
              padding: "0 20px",
              color: "var(--danger)",
              fontSize: ".82rem",
            }}
          >
            {saveError}
          </p>
        )}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            padding: 20,
            borderTop: "1px solid var(--line)",
          }}
        >
          <button
            type="button"
            disabled={saving || uploading}
            onClick={cancel}
            className="stx-btn stx-btn-outline"
          >
            Cancel
          </button>
          <button
            type="submit"
            value="close"
            disabled={!canSave || saving}
            className="stx-btn stx-btn-primary"
            onClick={() => (addAnotherClicked.current = false)}
          >
            {saving ? "Saving…" : "Save product"}
          </button>
          {isNew && (
            <button
              type="submit"
              value="another"
              disabled={!canSave || saving}
              className="stx-btn stx-btn-outline"
              onClick={() => (addAnotherClicked.current = true)}
            >
              Save &amp; add another
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

// Under each photo: whether it is the cover and which options show it.
function PhotoTag({ cover, options }) {
  if (!cover && !options.length) return null;
  return (
    <div className="photo-tag">
      {[cover && "Cover", ...options].filter(Boolean).join(" · ")}
    </div>
  );
}
