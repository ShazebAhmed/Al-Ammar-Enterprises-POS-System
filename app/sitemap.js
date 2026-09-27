import { createClient } from "@/lib/supabase";
export const revalidate = 3600;
export default async function sitemap() {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (!base) return [];
  const db = createClient();
  const entries = [];
  if (db)
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await db
        .from("products")
        .select("id,created_at")
        .order("id")
        .range(offset, offset + 499);
      if (error || !data) break;
      entries.push(
        ...data.map((p) => ({
          url: `${base}/product/${p.id}`,
          lastModified: p.created_at,
          changeFrequency: "weekly",
          priority: 0.8,
        })),
      );
      if (data.length < 500) break;
    }
  return [{ url: base, changeFrequency: "daily", priority: 1 }, ...entries];
}
