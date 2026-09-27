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
    stock: Math.max(0, Math.floor(Number(row.stock) || 0)),
    description: row.description,
    images: row.images || [],
    videoUrl: row.video_url || "",
    createdAt: row.created_at,
  };
}
export function orderFromRow(row) {
  return {
    id: row.id,
    customerId: row.customer_id,
    items: Array.isArray(row.items) ? row.items : [],
    subtotal: Number(row.subtotal) || 0,
    shippingFee: Number(row.shipping_fee) || 0,
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
    createdAt: row.created_at,
  };
}
