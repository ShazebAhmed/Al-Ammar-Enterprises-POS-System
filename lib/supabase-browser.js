// The browser's Supabase client. The library is large (sign-in, database, storage),
// so it is downloaded after the page has shown instead of with it; see Providers.
let client;
export async function loadBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  if (!client) {
    const { createClient } = await import("@supabase/supabase-js");
    client = createClient(url, key);
  }
  return client;
}
