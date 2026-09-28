import "./globals.css";
import { getSettings } from "@/lib/catalogue";
import Providers from "@/components/Providers";
import AppShell from "@/components/AppShell";
import ServiceWorker from "@/components/ServiceWorker";
export const revalidate = 60;
export const viewport = { themeColor: "#174f42" };
export async function generateMetadata() {
  const settings = await getSettings();
  const name = settings.storeName || "Al-Ammar";
  const description =
    settings.tagline ||
    settings.aboutText ||
    `Discover everyday essentials at ${name}. Shop online with cash on delivery.`;
  return {
    metadataBase: new URL(
      process.env.NEXT_PUBLIC_SITE_URL || "https://alammarstore.vercel.app",
    ),
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
  return (
    <html lang="en">
      <body className="stx-root">
        <Providers>
          <AppShell settings={settings}>{children}</AppShell>
        </Providers>
        <ServiceWorker />
      </body>
    </html>
  );
}
