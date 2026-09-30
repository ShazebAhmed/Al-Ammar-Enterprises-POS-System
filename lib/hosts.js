// The two live addresses. The admin panel has its own, so its sign-in,
// notifications and service worker are separate from the shop's (see
// middleware.js). Vercel previews and localhost serve both from one address.
export const STORE_HOST = "alammarstore.vercel.app";
export const ADMIN_HOST = "alammar-admin.vercel.app";
