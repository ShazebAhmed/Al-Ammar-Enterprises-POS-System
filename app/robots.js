export default function robots() {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://example.com";
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/admin", "/account", "/cart", "/checkout", "/auth", "/reset-password"] },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
