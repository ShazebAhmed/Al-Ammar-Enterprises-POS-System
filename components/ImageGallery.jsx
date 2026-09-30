"use client";
import { photo, PHOTO_SIZES } from "@/lib/photo";
import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";

// Choosing a colour shows only its photos: the event's detail is
// { images, label } (an empty list shows every photo again). A plain photo
// address, from older pages, shows that photo.
export const SHOW_PHOTO_EVENT = "al-ammar:show-photo";

// Product page photos: swipe the large photo on phones, arrows on hover with a
// mouse, and thumbnails that follow along. Uses the same scroll-snap track as
// the product cards (.card-slides in globals.css).
export default function ImageGallery({ images, name }) {
  const [activeImg, setActiveImg] = useState(0);
  // The chosen colour's photos, while only those are shown.
  const [only, setOnly] = useState(null);
  const track = useRef(null);
  const all = images || [];
  const photos = only ? only.images : all;
  useEffect(() => {
    const onShow = (e) => {
      const detail = e.detail;
      if (typeof detail === "string") {
        const i = all.indexOf(detail);
        if (i < 0) return;
        setOnly(null);
        requestAnimationFrame(() => show(i, "auto"));
        return;
      }
      const list = (detail?.images || []).filter((u) => all.includes(u));
      setOnly(list.length ? { images: list, label: detail.label || "" } : null);
    };
    window.addEventListener(SHOW_PHOTO_EVENT, onShow);
    return () => window.removeEventListener(SHOW_PHOTO_EVENT, onShow);
  });
  // A new set of photos starts at its first one.
  useEffect(() => {
    track.current?.scrollTo({ left: 0 });
    setActiveImg(0);
  }, [only]);

  function onScroll() {
    const el = track.current;
    if (el?.clientWidth)
      setActiveImg(Math.round(el.scrollLeft / el.clientWidth));
  }
  function show(i, behavior = "smooth") {
    const el = track.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior });
    setActiveImg(i);
  }

  return (
    <div>
      <div className="gallery-main">
        {photos.length ? (
          <div
            className="card-slides"
            ref={track}
            onScroll={onScroll}
            aria-label={`${name}: ${photos.length} photos`}
          >
            {photos.map((src, i) => (
              <div className="card-slide photo-full" key={src}>
                <img
                  className="photo-backdrop"
                  {...photo(src, PHOTO_SIZES.backdrop)}
                  alt=""
                  aria-hidden="true"
                  loading={i === 0 ? "eager" : "lazy"}
                  decoding="async"
                  draggable={false}
                />
                <img
                  className="photo-main"
                  {...photo(src, PHOTO_SIZES.gallery)}
                  alt={photos.length > 1 ? `${name}, photo ${i + 1}` : name}
                  loading={i === 0 ? "eager" : "lazy"}
                  decoding="async"
                  draggable={false}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="gallery-empty">
            <Icon name="inventory_2" size={48} color="var(--ink-soft)" />
          </div>
        )}
        {activeImg > 0 && (
          <button
            type="button"
            className="card-nav prev"
            aria-label="Previous photo"
            onClick={() => show(activeImg - 1)}
          >
            <Icon name="chevron_left" size={18} />
          </button>
        )}
        {activeImg < photos.length - 1 && (
          <button
            type="button"
            className="card-nav next"
            aria-label="Next photo"
            onClick={() => show(activeImg + 1)}
          >
            <Icon name="chevron_right" size={18} />
          </button>
        )}
        {photos.length > 1 && (
          <span className="gallery-count" aria-hidden="true">
            {activeImg + 1} / {photos.length}
          </span>
        )}
      </div>
      {only && (
        <p className="gallery-filter" role="status">
          <span>
            {only.label ? `${only.label} photos` : "This colour's photos"}
          </span>
          <button type="button" onClick={() => setOnly(null)}>
            Show all {all.length} photos
          </button>
        </p>
      )}
      {photos.length > 1 && (
        <div className="gallery-thumbnails">
          {photos.map((img, i) => (
            <button
              aria-label={`View image ${i + 1}`}
              aria-pressed={i === activeImg}
              key={img}
              onClick={() => show(i)}
              style={{
                width: 58,
                height: 58,
                borderRadius: 8,
                overflow: "hidden",
                border:
                  i === activeImg
                    ? "2px solid var(--primary)"
                    : "1px solid var(--line)",
                padding: 0,
                cursor: "pointer",
              }}
            >
              <img
                {...photo(img, PHOTO_SIZES.thumb)}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
