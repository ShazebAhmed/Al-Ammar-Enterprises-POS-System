"use client";
import Icon from "./Icon";

export default function StarInput({ value, onChange }) {
  return (
    <div style={{ display: "inline-flex", gap: 4 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          style={{
            background: "none",
            border: "none",
            padding: 2,
            cursor: "pointer",
          }}
          aria-label={`${n} star`}
        >
          <Icon
            name="star"
            size={22}
            fill={n <= value}
            color={n <= value ? "#D9A62B" : "#DDD9CC"}
          />
        </button>
      ))}
    </div>
  );
}
