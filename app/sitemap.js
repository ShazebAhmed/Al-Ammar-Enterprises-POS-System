import { createClient } from "@/lib/supabase";

export default async function sitemap() {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://example.com";
  const supabase = createClient();
  const { data } = await supabase.from("products").select("id, created_at");

  const productEntries = (data || []).map((p) => ({
    url: `${base}/product/${p.id}`,
    lastModified: p.created_at,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [
    { url: base, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    ...productEntries,
  ];
}
