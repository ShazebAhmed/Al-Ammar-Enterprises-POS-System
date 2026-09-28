import "./globals.css";
import { preconnect } from "react-dom";
import {
  DM_Sans,
  Manrope,
  Playfair_Display,
  Great_Vibes,
} from "next/font/google";
import { getSettings } from "@/lib/catalogue";
import Providers from "@/components/Providers";
import AppShell from "@/components/AppShell";
import ServiceWorker from "@/components/ServiceWorker";
import { SITE_URL } from "@/lib/seo";
export const revalidate = 60;
// Fonts are served with the site (no request to Google while the page loads).
const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-dm-sans",
  display: "swap",
});
const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-manrope",
  display: "swap",
});
const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-playfair",
  display: "swap",
});
// Only on the bill, so it is not preloaded on every page.
const greatVibes = Great_Vibes({
  subsets: ["latin"],
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
