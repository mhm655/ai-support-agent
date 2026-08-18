import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// A single browser client instance, reused across the app.
// This is the MVP-simple approach: session lives in localStorage via
// supabase-js's default storage. If you later add server components that
// need the user's session (SSR data fetching, middleware route protection),
// switch to @supabase/ssr instead — ask and we can migrate then.
export const supabase = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);
