import "./globals.css";
import { createClient } from "@/lib/supabase";
import { settingsFromRow, DEFAULT_SETTINGS } from "@/lib/format";
import Providers from "@/components/Providers";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const revalidate = 60;

async function getSettings() {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.from("store_settings").select("*").eq("id", 1).single();
    if (error) throw error;
    return settingsFromRow(data);
  } catch (e) {
    return DEFAULT_SETTINGS;
  }
}

export async function generateMetadata() {
  const settings = await getSettings();
  const name = settings.storeName || "Online Store";
  return {
    title: { default: name, template: `%s · ${name}` },
    description: settings.tagline || settings.aboutText || `Shop online at ${name}.`,
  };
}

export default async function RootLayout({ children }) {
  const settings = await getSettings();
  return (
    <html lang="en">
      <body className="stx-root">
        <Providers>
          <Header settings={settings} />
          {children}
          <Footer settings={settings} />
        </Providers>
      </body>
    </html>
  );
}
