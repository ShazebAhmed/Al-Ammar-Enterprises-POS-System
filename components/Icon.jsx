const paths = {
  shopping_cart: "M3 3h2l3 12h10l3-9H6M9 20h.01M18 20h.01",
  person: "M20 21v-2a7 7 0 0 0-14 0v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
  search: "m21 21-5-5M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14",
  inventory_2: "m3 7 9 5 9-5M12 12v10M3 7v10l9 5 9-5V7l-9-5-9 5m5-3 9 5",
  chevron_left: "m15 18-6-6 6-6",
  chevron_right: "m9 18 6-6-6-6",
  arrow_forward: "M4 12h16m-6-6 6 6-6 6",
  add: "M12 5v14M5 12h14",
  add_circle: "M12 8v8M8 12h8M22 12a10 10 0 1 0-20 0 10 10 0 0 0 20 0",
  remove: "M5 12h14",
  close: "m6 6 12 12M6 18 18 6",
  check: "m5 12 4 4L19 6",
  menu: "M4 6h16M4 12h16M4 18h16",
  home: "m3 10 9-7 9 7v11h-6v-7H9v7H3z",
  star: "m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z",
  call: "M22 16.9v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7l.5 3a2 2 0 0 1-.6 1.7L7.7 9.7a16 16 0 0 0 6.6 6.6l1.3-1.3a2 2 0 0 1 1.7-.6l3 .5a2 2 0 0 1 1.7 2z",
  dashboard: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  list_alt: "M4 3h16v18H4zM8 8h8M8 12h8M8 16h5",
  group:
    "M16 21v-2a6 6 0 0 0-12 0v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M20 21v-2a6 6 0 0 0-3-5M17 3a4 4 0 0 1 0 8",
  chat: "M21 15a3 3 0 0 1-3 3H8l-5 4V5a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3zM7 7h10M7 12h6",
  settings:
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z",
  lock: "M5 10h14v11H5zM8 10V6a4 4 0 0 1 8 0v4M12 14v3",
  fact_check: "M4 3h16v18H4zM8 8h8m-8 7 2 2 6-6",
  account_balance_wallet: "M3 5h18v16H3zM3 5V3h15v2M16 11h5v5h-5z",
  warning: "m12 3 10 18H2zM12 9v5M12 17h.01",
  edit: "m16 3 5 5-12 12-6 1 1-6zM14 5l5 5",
  delete: "M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7",
  upload: "M12 16V3m-5 5 5-5 5 5M3 15v6h18v-6",
  download: "M12 3v13m-5-5 5 5 5-5M3 15v6h18v-6",
  location_on:
    "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0M12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6",
  logout: "M9 3H3v18h6M9 12h12m-5-5 5 5-5 5",
  videocam: "M3 5h12v14H3zM15 10l6-4v12l-6-4",
  local_shipping:
    "M1 5h13v12H1zM14 9h4l4 5v3h-8M5 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4M18 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4",
  tune: "M4 7h16M4 17h16M8 4v6M16 14v6",
};
export default function Icon({
  name,
  size = 18,
  color,
  fill = false,
  style = {},
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0, verticalAlign: "middle", color, ...style }}
    >
      <path d={paths[name] || paths.inventory_2} />
    </svg>
  );
}
