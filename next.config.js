// Content Security Policy: the browser only runs scripts from this site and only
// talks to this site and Supabase, so code injected from elsewhere cannot run or
// send data out. Next.js needs inline scripts (and eval while developing).
const supabase = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin;
  } catch {
    return "https://*.supabase.co";
  }
})();
const dev = process.env.NODE_ENV !== "production";
// Vercel's comment toolbar on preview deployments.
const preview = process.env.VERCEL_ENV === "preview";
const vercelLive = preview ? " https://vercel.live" : "";
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}${vercelLive}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabase}${preview ? " https://vercel.live https://vercel.com" : ""}`,
  "font-src 'self' data:",
  `connect-src 'self' ${supabase} ${supabase.replace("https://", "wss://")}${vercelLive}`,
  `media-src 'self' blob: ${supabase}`,
  `frame-src https://www.youtube-nocookie.com${vercelLive}`,
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

// Security headers for every page and file. The site is never shown inside another
// site's frame, and browsers must not guess file types or send full addresses to
// other sites.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: csp },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**.supabase.co" }],
    // Photos never change at the same address (a new upload gets a new name).
    minimumCacheTTL: 31536000,
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

module.exports = nextConfig;
