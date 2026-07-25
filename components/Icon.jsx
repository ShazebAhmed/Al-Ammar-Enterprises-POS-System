export default function Icon({ name, size = 18, color, fill = false, style = {} }) {
  return (
    <span
      className="material-symbols-outlined"
      style={{
        fontSize: size,
        color: color || "currentColor",
        fontVariationSettings: `'FILL' ${fill ? 1 : 0}, 'wght' 500, 'GRAD' 0, 'opsz' 22`,
        ...style,
      }}
    >
      {name}
    </span>
  );
}
