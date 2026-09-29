"use client";
import { photo, PHOTO_SIZES } from "@/lib/photo";
import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";

// Choosing an option with its own photo (for example a colour) shows that photo.
export const SHOW_PHOTO_EVENT = "al-ammar:show-photo";

// Product page photos: swipe the large photo on phones, arrows on hover with a
// mouse, and thumbnails that follow along. Uses the same scroll-snap track as
// the product cards (.card-slides in globals.css).
export default function ImageGallery({ images, name }) {
  const [activeImg, setActiveImg] = useState(0);
  const track = useRef(null);
  const photos = images || [];
  useEffect(() => {
    const onShow = (e) => {
      const i = photos.indexOf(e.detail);
      if (i >= 0) show(i);
    };
    window.addEventListener(SHOW_PHOTO_EVENT, onShow);
    return () => window.removeEventListener(SHOW_PHOTO_EVENT, onShow);
  });

  function onScroll() {
    const el = track.current;
    if (el?.clientWidth)
      setActiveImg(Math.round(el.scrollLeft / el.clientWidth));
  }
  function show(i) {
    const el = track.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
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
