/* ---------------------------------------------------------------------
   SHARED HELPERS + DATA-LAYER MAPPERS
   Used by both Server Components (app/page.js, app/product/[id]/page.js)
   and Client Components (cart, checkout, account, admin).
--------------------------------------------------------------------- */

export const uid = (prefix = "") =>
  prefix + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

export function formatMoney(amount, symbol) {
  const n = Number(amount) || 0;
  return `${symbol || "Rs."} ${n.toLocaleString("en-PK", { maximumFractionDigits: 0 })}`;
}

export function compressImage(file, maxWidth = 1000, quality = 0.68) {
  return new Promise((resolve, reject) => {
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
        canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function getVideoEmbed(url) {
  if (!url) return null;
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,})/);
  if (yt) return { type: "youtube", id: yt[1] };
  return { type: "file", src: url };
}

export const DEFAULT_SETTINGS = {
  storeName: "", tagline: "", logoInitial: "", currencySymbol: "Rs.",
  shippingFee: 150, contactPhone: "", whatsapp: "", aboutText: "",
  categories: ["Groceries", "Home & Kitchen", "Fashion", "Electronics", "Beauty", "Other"],
};

export const ORDER_STATUSES = ["Pending", "Confirmed", "Shipped", "Delivered", "Cancelled"];
export const STATUS_COLOR = {
  Pending: "#B3860F", Confirmed: "#0E5C50", Shipped: "#2B6CB0", Delivered: "#1F7A3D", Cancelled: "#B3261E",
};

export function settingsFromRow(row) {
  return {
    storeName: row.store_name || "", tagline: row.tagline || "", logoInitial: row.logo_initial || "",
    currencySymbol: row.currency_symbol || "Rs.", shippingFee: row.shipping_fee ?? 150,
    contactPhone: row.contact_phone || "", whatsapp: row.whatsapp || "", aboutText: row.about_text || "",
    categories: row.categories || [],
  };
}
export function settingsToRow(patch) {
  const map = {
    storeName: "store_name", tagline: "tagline", logoInitial: "logo_initial",
    currencySymbol: "currency_symbol", shippingFee: "shipping_fee", contactPhone: "contact_phone",
    whatsapp: "whatsapp", aboutText: "about_text", categories: "categories",
  };
  const row = {};
  for (const key in patch) if (map[key]) row[map[key]] = patch[key];
  return row;
}
export function productFromRow(row) {
  return {
    id: row.id, name: row.name, category: row.category, price: row.price, stock: row.stock,
    description: row.description, images: row.images || [], videoUrl: row.video_url || "", createdAt: row.created_at,
  };
}
export function orderFromRow(row) {
  return {
    id: row.id, customerId: row.customer_id, items: row.items,
    subtotal: row.subtotal, shippingFee: row.shipping_fee, total: row.total,
    customer: { name: row.customer_name, phone: row.customer_phone, address: row.customer_address, city: row.customer_city, notes: row.customer_notes },
    status: row.status, createdAt: row.created_at,
  };
}
export function reviewFromRow(row) {
  return { id: row.id, productId: row.product_id, name: row.customer_name, rating: row.rating, comment: row.comment, createdAt: row.created_at };
}
