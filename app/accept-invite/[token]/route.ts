import { NextResponse, type NextRequest } from "next/server";
import { ACTIVE_ORG_COOKIE, PENDING_INVITE_COOKIE } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";

// GET /accept-invite/<raw-token>
// - Logged out: remember the token in a cookie and send them to sign in / up.
// - Logged in: accept via the SECURITY DEFINER RPC, set the active org, go in.
// A route handler (not a page) so it can set cookies + redirect.
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  const origin = req.nextUrl.origin;
  const prod = process.env.NODE_ENV === "production";

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();

  if (!claims?.claims) {
    const res = NextResponse.redirect(
      new URL(
        `/login?next=${encodeURIComponent(`/accept-invite/${token}`)}`,
        origin,
      ),
    );
    // Survives the sign-up → email-confirm round trip (next is lost there);
    // the app layout picks it up so the new user joins instead of onboarding.
    res.cookies.set(PENDING_INVITE_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: prod,
      maxAge: 60 * 60,
    });
    return res;
  }

  const { data: orgId, error } = await supabase.rpc("accept_invitation", {
    p_raw_token: token,
  });

  if (error || !orgId) {
    const res = NextResponse.redirect(
      new URL(`/onboarding?invite=invalid`, origin),
    );
    res.cookies.delete(PENDING_INVITE_COOKIE);
    return res;
  }

  const res = NextResponse.redirect(new URL(`/dashboard`, origin));
  res.cookies.set(ACTIVE_ORG_COOKIE, String(orgId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: prod,
    maxAge: 60 * 60 * 24 * 365,
  });
  res.cookies.delete(PENDING_INVITE_COOKIE);
  return res;
}
