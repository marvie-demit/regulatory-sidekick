import { NextResponse, type NextRequest } from "next/server";
import { getActiveOrg } from "@/lib/auth/org";
import { createClient } from "@/lib/supabase/server";

// GET /redeem/<code> — an org admin redeems an access code for their active
// workspace. (Middleware sends logged-out users to /login?next first.)
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ code: string }> },
) {
  const { code } = await ctx.params;
  const origin = req.nextUrl.origin;

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) {
    return NextResponse.redirect(
      new URL(`/login?next=${encodeURIComponent(`/redeem/${code}`)}`, origin),
    );
  }

  const org = await getActiveOrg();
  if (!org) return NextResponse.redirect(new URL(`/onboarding`, origin));
  if (org.role !== "admin")
    return NextResponse.redirect(new URL(`/pricing?redeem=notadmin`, origin));

  const { error } = await supabase.rpc("redeem_access_code", {
    p_raw_code: code,
    p_org: org.id,
  });
  if (error)
    return NextResponse.redirect(new URL(`/pricing?redeem=invalid`, origin));
  return NextResponse.redirect(new URL(`/dashboard?redeem=ok`, origin));
}
