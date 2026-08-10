import { NextResponse, type NextRequest } from "next/server";
import {
  ACTIVE_PARTNER_COOKIE,
  PENDING_PARTNER_INVITE_COOKIE,
} from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";

// GET /accept-partner-invite/<raw-token>
// Mirrors /accept-invite for partner staff. A route handler (not a page) so it
// can set cookies and redirect.
// - Logged out: remember the token and send them to sign in / up.
// - Logged in: accept via the SECURITY DEFINER RPC, pin the partner, go in.
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
        `/login?next=${encodeURIComponent(`/accept-partner-invite/${token}`)}`,
        origin,
      ),
    );
    // Survives the sign-up → email-confirm round trip, where `next` is lost.
    // The app layout picks it up so a brand-new partner staffer joins the
    // partner instead of being pushed into creating a QMS workspace.
    res.cookies.set(PENDING_PARTNER_INVITE_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: prod,
      maxAge: 60 * 60,
    });
    return res;
  }

  const { data: partnerId, error } = await supabase.rpc(
    "accept_partner_invitation",
    { p_raw_token: token },
  );

  if (error || !partnerId) {
    const res = NextResponse.redirect(
      new URL(`/login?partnerInvite=invalid`, origin),
    );
    res.cookies.delete(PENDING_PARTNER_INVITE_COOKIE);
    return res;
  }

  const res = NextResponse.redirect(new URL(`/partner`, origin));
  res.cookies.set(ACTIVE_PARTNER_COOKIE, String(partnerId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: prod,
    maxAge: 60 * 60 * 24 * 365,
  });
  res.cookies.delete(PENDING_PARTNER_INVITE_COOKIE);
  return res;
}
