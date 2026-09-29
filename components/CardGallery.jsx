"use client";
import { photo, PHOTO_SIZES } from "@/lib/photo";
import Link from "next/link";
import { useRef, useState } from "react";
import Icon from "./Icon";

// Photos on a product card. Swipe on phones (native scroll snapping), arrows on
// hover with a mouse; tapping any photo opens the product.
export default function CardGallery({ images, name, href }) {
  const track = useRef(null);
  const [index, setIndex] = useState(0);
  const photos = images.slice(0, 5);

  if (photos.length < 2)
    return (
      <Link className="card-slide" href={href}>
        <img
          {...photo(photos[0], PHOTO_SIZES.card)}
          alt={name}
          loading="lazy"
          decoding="async"
        />
        <span className="image-arrow">
          <Icon name="arrow_forward" size={18} />
        </span>
      </Link>
    );

  function onScroll() {
    const el = track.current;
    if (el?.clientWidth) setIndex(Math.round(el.scrollLeft / el.clientWidth));
  }
  function go(step) {
    const el = track.current;
    el?.scrollTo({ left: (index + step) * el.clientWidth, behavior: "smooth" });
  }

  return (
    <>
      <div
        className="card-slides"
        ref={track}
        onScroll={onScroll}
        aria-label={`${name}: ${photos.length} photos`}
      >
        {photos.map((src, i) => (
          <Link
            key={src}
            className="card-slide"
            href={href}
            tabIndex={i === index ? 0 : -1}
            aria-label={`${name}, photo ${i + 1} of ${photos.length}`}
          >
            <img
              {...photo(src, PHOTO_SIZES.card)}
              alt={i === 0 ? name : ""}
              loading="lazy"
              decoding="async"
              draggable={false}
            />
          </Link>
        ))}
      </div>
      {index > 0 && (
        <button
          type="button"
          className="card-nav prev"
          aria-label="Previous photo"
          onClick={() => go(-1)}
        >
          <Icon name="chevron_left" size={16} />
        </button>
      )}
      {index < photos.length - 1 && (
        <button
          type="button"
          className="card-nav next"
          aria-label="Next photo"
          onClick={() => go(1)}
        >
          <Icon name="chevron_right" size={16} />
        </button>
      )}
      <div className="card-dots" aria-hidden="true">
        {photos.map((src, i) => (
          <span key={src} className={i === index ? "on" : ""} />
        ))}
      </div>
    </>
  );
}
