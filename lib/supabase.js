import { createClient as createSupabaseClient } from "@supabase/supabase-js";
// Server reads only (catalogue, settings, sitemap). The browser's client is in
// supabase-browser.js.
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createSupabaseClient(url, key, {
    // Server reads (catalogue, settings) are shared by every visitor, so keep
    // them for a minute instead of asking the database on each page view.
    global: {
      fetch: (input, init) =>
        fetch(input, { ...init, next: { revalidate: 60 } }),
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
