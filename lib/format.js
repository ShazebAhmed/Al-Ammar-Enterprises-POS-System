/* ---------------------------------------------------------------------
   SHARED HELPERS + DATA-LAYER MAPPERS
   Used by both Server Components (app/page.js, app/product/[id]/page.js)
   and Client Components (cart, checkout, account, admin).
--------------------------------------------------------------------- */

export const uid = (prefix = "") => prefix + globalThis.crypto.randomUUID();

export function formatMoney(amount, symbol) {
  const n = Number(amount) || 0;
  return `${symbol || "Rs."} ${n.toLocaleString("en-PK", { maximumFractionDigits: 2 })}`;
}

export function compressImage(file, maxWidth = 1000, quality = 0.68) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) {
      reject(new Error("Choose an image under 10 MB."));
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) =>
            blob ? resolve(blob) : reject(new Error("Image conversion failed")),
          "image/jpeg",
          quality,
        );
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function getVideoEmbed(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    const host = url.hostname.replace(/^www\./, "");
    const id =
      host === "youtu.be"
        ? url.pathname.slice(1)
        : ["youtube.com", "m.youtube.com"].includes(host)
          ? url.searchParams.get("v") ||
            url.pathname.match(/\/(?:embed|shorts)\/([^/]+)/)?.[1]
          : null;
    if (id && /^[\w-]{11}$/.test(id)) return { type: "youtube", id };
    return /\.(mp4|webm|ogg)$/i.test(url.pathname)
      ? { type: "file", src: url.href }
      : null;
  } catch {
    return null;
  }
}

export const DEFAULT_SETTINGS = {
  storeName: "Al-Ammar",
  tagline: "",
  logoInitial: "A",
  currencySymbol: "Rs.",
  shippingFee: 150,
  contactPhone: "",
  whatsapp: "",
  aboutText: "",
  categories: [
    "Groceries",
    "Home & Kitchen",
    "Fashion",
    "Electronics",
    "Beauty",
    "Other",
  ],
};

export const ORDER_STATUSES = [
  "Pending",
  "Confirmed",
  "Shipped",
  "Delivered",
  "Cancelled",
];
export const STATUS_COLOR = {
  Pending: "#B3860F",
  Confirmed: "#0E5C50",
  Shipped: "#2B6CB0",
  Delivered: "#1F7A3D",
  Cancelled: "#B3261E",
};

export function settingsFromRow(row) {
  return {
    storeName: row.store_name || "Al-Ammar",
    tagline: row.tagline || "",
    logoInitial: row.logo_initial || "",
    currencySymbol: row.currency_symbol || "Rs.",
    shippingFee: row.shipping_fee ?? 150,
    contactPhone: row.contact_phone || "",
    whatsapp: row.whatsapp || "",
    aboutText: row.about_text || "",
    categories: row.categories || [],
  };
}
export function settingsToRow(patch) {
  const map = {
    storeName: "store_name",
    tagline: "tagline",
    logoInitial: "logo_initial",
    currencySymbol: "currency_symbol",
    shippingFee: "shipping_fee",
    contactPhone: "contact_phone",
    whatsapp: "whatsapp",
    aboutText: "about_text",
    categories: "categories",
  };
  const row = {};
  for (const key in patch) if (map[key]) row[map[key]] = patch[key];
  return row;
}
export function productFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    price: Number(row.price) || 0,
    // The old price, shown struck through, only while it is higher than the price.
    compareAtPrice:
      Number(row.compare_at_price) > Number(row.price)
        ? Number(row.compare_at_price)
        : null,
    stock: Math.max(0, Math.floor(Number(row.stock) || 0)),
    // Options such as sizes, each with its own stock: [{ name, stock }].
    optionLabel: row.option_label || "",
    variants: Array.isArray(row.variants)
      ? row.variants.map((v) => ({
          name: String(v.name),
          stock: Math.max(0, Math.floor(Number(v.stock) || 0)),
        }))
      : [],
    description: row.description,
    images: row.images || [],
    videoUrl: row.video_url || "",
    createdAt: row.created_at,
  };
}
// "Wallet (Brown)" for an order or basket line with an option.
export function itemName(name, variant) {
  return variant ? `${name} (${variant})` : name;
}
// "25" for a product on sale at 25% off, otherwise 0.
export function salePercent(product) {
  if (!product?.compareAtPrice || !(product.compareAtPrice > product.price))
    return 0;
  return Math.round((1 - product.price / product.compareAtPrice) * 100);
}
// "27 Sep 2026, 3:46 pm" in Pakistan time, whatever the viewer's time zone.
export function formatOrderTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Karachi",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}
export function orderFromRow(row) {
  return {
    id: row.id,
    customerId: row.customer_id,
    items: Array.isArray(row.items) ? row.items : [],
    subtotal: Number(row.subtotal) || 0,
    shippingFee: Number(row.shipping_fee) || 0,
    discount: Number(row.discount) || 0,
    couponCode: row.coupon_code || "",
    total: Number(row.total) || 0,
    customer: {
      name: row.customer_name,
      phone: row.customer_phone,
      address: row.customer_address,
      city: row.customer_city,
      notes: row.customer_notes,
    },
    status: row.status,
    createdAt: row.created_at,
  };
}
export function reviewFromRow(row) {
  return {
    id: row.id,
    productId: row.product_id,
    name: row.customer_name,
    rating: Number(row.rating) || 0,
    comment: row.comment,
    approved: row.approved !== false,
    createdAt: row.created_at,
  };
}

// Print a bill. The page title becomes the saved PDF's file name
// (e.g. "AlAmmar-Bill-AA-10001.pdf"); the old title comes back afterwards.
// On Android print() returns at once and the dialog reads the title later,
// so wait until the page has focus again before restoring it.
export function printBill(orderId) {
  const previous = document.title;
  document.title = `AlAmmar-Bill-${orderId}`;
  const restore = () => {
    document.title = previous;
  };
  window.print();
  setTimeout(() => {
    if (document.hasFocus()) restore();
    else window.addEventListener("focus", restore, { once: true });
  }, 1000);
}
