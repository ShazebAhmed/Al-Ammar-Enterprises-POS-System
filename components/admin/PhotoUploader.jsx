"use client";
import { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";
import { compressImage, uid } from "@/lib/format";

const MAX_FILE = 10 * 1024 * 1024;

function uploadError(error) {
  const status = Number(error?.statusCode || error?.status);
  const message = error?.message || "";
  if (message.startsWith("Choose an image")) return message;
  if (
    status === 403 ||
    /row.level security|unauthoriz|permission/i.test(message)
  )
    return "Upload permission denied. Check your admin access, then retry.";
  if (/bucket.*not found/i.test(message))
    return "Image storage is unavailable. Check the store's storage setup.";
  return "Could not upload. Check your connection or try another photo.";
}

// A set of photos: thumbnails that can be reordered or removed, and a tile to
// add more by tapping or by dropping files on it. Photos upload one after
// another; each one is added to the set as soon as it has uploaded.
//
// `onChange` receives an updater (list => new list), so uploads finishing
// later never overwrite changes made in the meantime.
export default function PhotoUploader({
  photos,
  onChange,
  max,
  onUpload,
  onUploaded,
  onRemove,
  onPendingChange,
  label,
  addText = "Add photos",
  emptyHint,
  coverBadge = false,
  disabled = false,
}) {
  const [queue, setQueue] = useState([]);
  const [notice, setNotice] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef(null);
  const queueRef = useRef([]);
  const working = useRef(false);
  const alive = useRef(true);
  const previews = useRef(new Set());
  const pendingRef = useRef(onPendingChange);
  pendingRef.current = onPendingChange;

  useEffect(() => {
    alive.current = true;
    const urls = previews.current;
    return () => {
      alive.current = false;
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
      pendingRef.current?.(0);
    };
  }, []);
  useEffect(() => {
    pendingRef.current?.(queue.length);
  }, [queue.length]);

  function release(url) {
    if (!url) return;
    URL.revokeObjectURL(url);
    previews.current.delete(url);
  }
  // The upload list lives in a ref as well, so the upload loop always sees
  // files added or retried while it runs.
  function setQ(update) {
    queueRef.current = update(queueRef.current);
    setQueue(queueRef.current);
  }
  async function pump() {
    if (working.current) return;
    working.current = true;
    try {
      while (alive.current) {
        const entry = queueRef.current.find((x) => x.status === "queued");
        if (!entry) break;
        setQ((list) =>
          list.map((x) =>
            x.id === entry.id ? { ...x, status: "uploading", error: "" } : x,
          ),
        );
        try {
          if (!entry.file.type.startsWith("image/"))
            throw new Error("Choose an image file.");
          if (entry.file.size > MAX_FILE)
            throw new Error("Choose an image under 10 MB.");
          const blob = await compressImage(entry.file);
          const url = await onUpload(blob);
          onUploaded?.(url);
          if (!alive.current) break;
          onChange((list) => [...list, url]);
          setQ((list) => list.filter((x) => x.id !== entry.id));
          release(entry.preview);
        } catch (error) {
          if (!alive.current) break;
          setQ((list) =>
            list.map((x) =>
              x.id === entry.id
                ? { ...x, status: "failed", error: uploadError(error) }
                : x,
            ),
          );
        }
      }
    } finally {
      working.current = false;
    }
  }
  function addFiles(fileList) {
    const files = Array.from(fileList || []).filter(Boolean);
    if (!files.length || disabled) return;
    const room = Math.max(0, max - photos.length - queueRef.current.length);
    const chosen = files.slice(0, room);
    setNotice(
      files.length > room
        ? room
          ? `Only ${room} more ${room === 1 ? "photo fits" : "photos fit"} here (up to ${max}). The rest were not added.`
          : `This already has ${max} photos. Remove one to add another.`
        : "",
    );
    if (!chosen.length) return;
    const entries = chosen.map((file) => {
      const preview =
        file.type.startsWith("image/") && file.size <= MAX_FILE
          ? URL.createObjectURL(file)
          : "";
      if (preview) previews.current.add(preview);
      return { id: uid("up_"), file, preview, status: "queued", error: "" };
    });
    setQ((list) => [...list, ...entries]);
    pump();
  }
  function move(index, step) {
    onChange((list) => {
      const next = [...list];
      const to = index + step;
      if (to < 0 || to >= next.length) return list;
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });
  }
  function makeFirst(index) {
    onChange((list) => [list[index], ...list.filter((_, i) => i !== index)]);
  }
  function remove(url) {
    onChange((list) => list.filter((u) => u !== url));
    onRemove?.(url);
    setNotice("");
  }
  function dropEntry(entry) {
    if (entry.status === "uploading") return;
    release(entry.preview);
    setQ((list) => list.filter((x) => x.id !== entry.id));
    setNotice("");
  }
  function retry(entry) {
    setQ((list) =>
      list.map((x) => (x.id === entry.id ? { ...x, status: "queued" } : x)),
    );
    pump();
  }
  const full = photos.length + queue.length >= max;

  return (
    <div className="pu">
      <ul className="pu-grid" aria-label={label}>
        {photos.map((url, i) => (
          <li className="pu-item" key={url}>
            <img src={url} alt={`${label}: photo ${i + 1}`} />
            {coverBadge && i === 0 && <span className="pu-badge">Cover</span>}
            <div className="pu-tools">
              <button
                type="button"
                aria-label={`Move photo ${i + 1} left`}
                disabled={i === 0}
                onClick={() => move(i, -1)}
              >
                <Icon name="chevron_left" size={16} />
              </button>
              {coverBadge && i > 0 && (
                <button
                  type="button"
                  aria-label={`Make photo ${i + 1} the cover`}
                  title="Make this the cover"
                  onClick={() => makeFirst(i)}
                >
                  Set cover
                </button>
              )}
              <button
                type="button"
                aria-label={`Move photo ${i + 1} right`}
                disabled={i === photos.length - 1}
                onClick={() => move(i, 1)}
              >
                <Icon name="chevron_right" size={16} />
              </button>
            </div>
            <button
              type="button"
              className="pu-remove"
              aria-label={`Remove photo ${i + 1}`}
              onClick={() => remove(url)}
            >
              <Icon name="close" size={14} />
            </button>
          </li>
        ))}
        {queue.map((entry) => (
          <li className="pu-item pu-pending" key={entry.id}>
            {entry.preview && <img src={entry.preview} alt="" />}
            <div className="pu-state" role={entry.error ? "alert" : "status"}>
              {entry.status === "failed" ? (
                <>
                  <span>{entry.error}</span>
                  <span className="pu-state-actions">
                    <button type="button" onClick={() => retry(entry)}>
                      Retry
                    </button>
                    <button type="button" onClick={() => dropEntry(entry)}>
                      Remove
                    </button>
                  </span>
                </>
              ) : (
                <>
                  <span className="pu-spinner" aria-hidden="true" />
                  <span>
                    {entry.status === "uploading" ? "Uploading…" : "Waiting…"}
                  </span>
                </>
              )}
            </div>
          </li>
        ))}
        {!full && (
          <li>
            <button
              type="button"
              className={`pu-add${dragging ? " is-dragging" : ""}`}
              disabled={disabled}
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                addFiles(e.dataTransfer?.files);
              }}
            >
              <Icon name="upload" size={20} />
              <span>{addText}</span>
              <small>
                {photos.length + queue.length}/{max}
              </small>
            </button>
          </li>
        )}
      </ul>
      {!photos.length && !queue.length && emptyHint && (
        <p className="pu-hint">{emptyHint}</p>
      )}
      {notice && (
        <p className="pu-hint" role="status">
          {notice}
        </p>
      )}
      {queue.some((x) => x.status === "failed") && (
        <p className="pu-hint pu-error">
          Retry or remove the photos that did not upload before saving.
        </p>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        aria-label={`${addText} to ${label}`}
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
