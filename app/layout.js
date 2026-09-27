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
  return {
    title: {
      default: `${name} — The everyday, elevated`,
      template: `%s · ${name}`,
    },
    description:
      settings.tagline ||
      settings.aboutText ||
      `Discover everyday essentials at ${name}. Shop online with cash on delivery.`,
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
