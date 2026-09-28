// Browser side of order notifications (Web Push). See the push_notifications migration.

export function pushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function toBase64Url(bytes) {
  let text = "";
  for (const b of bytes) text += String.fromCharCode(b);
  return btoa(text)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}
function fromBase64Url(value) {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const text = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(text, (c) => c.charCodeAt(0));
}

// The site's signing key pair (VAPID, ECDSA P-256), made once in the admin's browser.
async function createKeys() {
  const pair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  const raw = new Uint8Array(
    await crypto.subtle.exportKey("raw", pair.publicKey),
  );
  const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  return { publicKey: toBase64Url(raw), privateKey: jwk.d };
}

async function publicKey(supabase, { setUp }) {
  const { data, error } = await supabase.rpc("push_public_key");
  if (error) throw error;
  if (data) return data;
  if (!setUp) throw new Error("not-ready");
  const keys = await createKeys();
  const saved = await supabase.rpc("set_push_keys", {
    p_public: keys.publicKey,
    p_private: keys.privateKey,
  });
  if (saved.error) throw saved.error;
  return saved.data;
}

// Asks permission and returns this browser's subscription for the site's key.
async function subscribe(key) {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("denied");
  await navigator.serviceWorker.register("/sw.js");
  const registration = await navigator.serviceWorker.ready;
  let sub = await registration.pushManager.getSubscription();
  const current = sub?.options?.applicationServerKey;
  if (sub && current && toBase64Url(new Uint8Array(current)) !== key) {
    await sub.unsubscribe();
    sub = null;
  }
  if (!sub)
    sub = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: fromBase64Url(key),
    });
  return sub.toJSON();
}

// Admin: notify this phone about every new order.
export async function watchNewOrders(supabase) {
  const key = await publicKey(supabase, { setUp: true });
  const sub = await subscribe(key);
  const { error } = await supabase.rpc("watch_new_orders", { p_sub: sub });
  if (error) throw error;
}

// Customer: notify this phone when this order is confirmed, shipped or delivered.
export async function watchOrder(supabase, orderId, phone) {
  const key = await publicKey(supabase, { setUp: false });
  const sub = await subscribe(key);
  const { error } = await supabase.rpc("watch_order", {
    p_order_id: orderId,
    p_phone: phone,
    p_sub: sub,
  });
  if (error) throw error;
}

// "denied" (blocked in settings), "not-ready" (store has not set up alerts yet)
// or anything else (connection).
export function pushErrorMessage(e) {
  if (e?.message === "denied")
    return "Notifications are blocked. Allow them in your phone or browser settings, then try again.";
  if (e?.message === "not-ready")
    return "Order notifications are not available yet. You can track your order on this page.";
  return "Could not turn on notifications. Please check your internet and try again.";
}
