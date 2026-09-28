import "./globals.css";
import { preconnect } from "react-dom";
import localFont from "next/font/local";
import { getSettings } from "@/lib/catalogue";
import Providers from "@/components/Providers";
import AppShell from "@/components/AppShell";
import ServiceWorker from "@/components/ServiceWorker";
import { SITE_URL } from "@/lib/seo";
export const revalidate = 60;
// Fonts are served with the site from npm packages: no request to Google while the
// page loads, and the build does not depend on Google being reachable.
const dmSans = localFont({
  src: "../node_modules/@fontsource-variable/dm-sans/files/dm-sans-latin-wght-normal.woff2",
  weight: "100 1000",
  variable: "--font-dm-sans",
  display: "swap",
  adjustFontFallback: "Arial",
});
const manrope = localFont({
  src: "../node_modules/@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2",
  weight: "200 800",
  variable: "--font-manrope",
  display: "swap",
  adjustFontFallback: "Arial",
});
const playfair = localFont({
  src: [
    {
      path: "../node_modules/@fontsource-variable/playfair-display/files/playfair-display-latin-wght-normal.woff2",
      style: "normal",
    },
    {
      path: "../node_modules/@fontsource-variable/playfair-display/files/playfair-display-latin-wght-italic.woff2",
      style: "italic",
    },
  ],
  weight: "400 900",
  variable: "--font-playfair",
  display: "swap",
  adjustFontFallback: "Times New Roman",
});
// Only on the bill, so it is not preloaded on every page.
const greatVibes = localFont({
  src: "../node_modules/@fontsource/great-vibes/files/great-vibes-latin-400-normal.woff2",
  weight: "400",
  variable: "--font-great-vibes",
  display: "swap",
  preload: false,
});
const fontVariables = [dmSans, manrope, playfair, greatVibes]
  .map((f) => f.variable)
  .join(" ");
export const viewport = { themeColor: "#174f42" };
export async function generateMetadata() {
  const settings = await getSettings();
  const name = settings.storeName || "Al-Ammar";
  const description =
    settings.tagline ||
    settings.aboutText ||
    `Discover everyday essentials at ${name}. Shop online with cash on delivery.`;
  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: `${name} — The everyday, elevated`,
      template: `%s · ${name}`,
    },
    description,
    // The preview shown when the shop link is shared on WhatsApp or Facebook.
    openGraph: {
      type: "website",
      siteName: name,
      title: `${name} — The everyday, elevated`,
      description,
      locale: "en_PK",
      images: [{ url: "/og.png", width: 1024, height: 500, alt: name }],
    },
    twitter: { card: "summary_large_image" },
  };
}
export default async function RootLayout({ children }) {
  const settings = await getSettings();
  // Product photos come from Supabase: open that connection early.
  if (process.env.NEXT_PUBLIC_SUPABASE_URL)
    preconnect(process.env.NEXT_PUBLIC_SUPABASE_URL);
  return (
    <html lang="en" className={fontVariables}>
      <body className="stx-root">
        <Providers>
          <AppShell settings={settings}>{children}</AppShell>
        </Providers>
        <ServiceWorker />
      </body>
    </html>
  );
}
