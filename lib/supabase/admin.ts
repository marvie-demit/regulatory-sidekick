import { createClient } from "@supabase/supabase-js";

// Service-role client — SERVER ONLY. Bypasses RLS, so never import this from a
// client component. Used to resolve member identities (email / name) for the
// team page and for admin auth operations. The secret key is never NEXT_PUBLIC_.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
