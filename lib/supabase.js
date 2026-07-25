import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Ek hi function, server (Server Components) aur browser (Client Components)
// dono jagah istemal ke liye. Isay session/cookies ki fikar nahi karni parti
// kyunke: (a) server-side sirf public data (products/settings/reviews) parhta
// hai, jahan RLS "using (true)" hai — login ki zaroorat nahi; (b) browser
// mein supabase-js khud localStorage mein session sambhal leta hai.
export function createClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
