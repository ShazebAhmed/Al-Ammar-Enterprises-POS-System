// Smoke test for a production build: starts `next start`, opens every public page
// and checks it answers, shows its main text and sends the security headers.
// Run after `npm run build`: `npm run smoke`. Works without Supabase settings
// (pages then show their empty or "unavailable" states).
import { spawn } from "node:child_process";

const PORT = 3999;
const BASE = `http://localhost:${PORT}`;
const PAGES = [
  ["/", 200, /Everyday finds/],
  ["/faq", 200, /Questions &amp; answers/],
  ["/policies/terms", 200, /The fine print/],
  ["/policies/shipping", 200, /Delivery charge/],
  ["/policies/returns", 200, /returns/i],
  ["/policies/privacy", 200, /What we collect/],
  ["/policies/delete-account", 200, /Delete it yourself/],
  ["/track", 200, /Track/],
  ["/cart", 200, /basket/i],
  ["/checkout", 200, /Make it yours/],
  ["/auth", 200, /Welcome back/],
  ["/reset-password", 200, /password/i],
  ["/product/not-a-product", 404, /./],
  ["/robots.txt", 200, /User-Agent/],
  ["/manifest.webmanifest", 200, /Al Ammar Store/],
  ["/offline.html", 200, /offline/i],
];

const server = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)],
  { stdio: "ignore" },
);
const failures = [];
try {
  for (let i = 0; ; i++) {
    try {
      await fetch(BASE);
      break;
    } catch {
      if (i > 60) throw new Error("next start did not answer");
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  for (const [path, status, text] of PAGES) {
    const res = await fetch(BASE + path, { redirect: "manual" });
    const body = await res.text();
    const csp = res.headers.get("content-security-policy") || "";
    if (res.status !== status)
      failures.push(`${path}: status ${res.status}, expected ${status}`);
    else if (!text.test(body)) failures.push(`${path}: expected text missing`);
    if (
      !csp.includes("default-src 'self'") ||
      !csp.includes("frame-ancestors 'none'")
    )
      failures.push(`${path}: Content-Security-Policy missing`);
    if (res.headers.get("x-content-type-options") !== "nosniff")
      failures.push(`${path}: X-Content-Type-Options missing`);
    console.log(`${res.status} ${path}`);
  }
} finally {
  server.kill();
}
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`All ${PAGES.length} pages OK`);
