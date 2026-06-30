import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Handles the PKCE / OAuth redirect (?code=...). Email+password sign-up uses
// /auth/confirm; this is here for OAuth and magic-link flows added later.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");
  const dest = next?.startsWith("/") ? next : "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(dest, origin));
    }
  }
  return NextResponse.redirect(new URL("/login?error=callback", origin));
}
