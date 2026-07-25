"use client";
import { useState } from "react";
import Icon from "./Icon";

export default function ImageGallery({ images, name }) {
  const [activeImg, setActiveImg] = useState(0);
  return (
    <div>
      <div style={{ aspectRatio: "1/1", background: "#EFEBDD", borderRadius: 12, overflow: "hidden", marginBottom: 10 }}>
        {images?.[activeImg] ? (
          <img src={images[activeImg]} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="inventory_2" size={48} color="var(--ink-soft)" /></div>
        )}
      </div>
      {images?.length > 1 && (
        <div style={{ display: "flex", gap: 8 }}>
          {images.map((img, i) => (
            <button key={i} onClick={() => setActiveImg(i)} style={{ width: 58, height: 58, borderRadius: 8, overflow: "hidden", border: i === activeImg ? "2px solid var(--primary)" : "1px solid var(--line)", padding: 0, cursor: "pointer" }}>
              <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
