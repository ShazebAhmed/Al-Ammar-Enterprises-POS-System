import Icon from "./Icon";

const ACCENT = "#D9A62B";
const LINE = "#DDD9CC";

export default function StarRow({ value, size = 14 }) {
  const full = Math.round(value || 0);
  return (
    <div style={{ display: "inline-flex", gap: 1 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Icon key={n} name="star" size={size} fill={n <= full} color={n <= full ? ACCENT : LINE} />
      ))}
    </div>
  );
}
