import { createClient as createSupabaseClient } from "@supabase/supabase-js";
let browserClient;
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  if (typeof window === "undefined") {
    return createSupabaseClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }
  if (!browserClient) browserClient = createSupabaseClient(url, key);
  return browserClient;
}
