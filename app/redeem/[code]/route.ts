import { NextResponse, type NextRequest } from "next/server";
import { PENDING_REDEEM_COOKIE } from "@/lib/constants";
import { getActiveOrg } from "@/lib/auth/org";
import { createClient } from "@/lib/supabase/server";

// GET /redeem/<code> — apply an access code to the visitor's active workspace.
// A code recipient is usually a NEW user, so logged-out visitors go to sign-up;
// the code is remembered in a cookie and applied once they have a workspace
// (survives sign-up → email confirm → onboarding).
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ code: string }> },
) {
  const { code } = await ctx.params;
  const origin = req.nextUrl.origin;
  const prod = process.env.NODE_ENV === "production";
  const cookieOpts = {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: prod,
    maxAge: 60 * 60,
  };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();

  // Not signed in → send to sign-up (the page links to sign-in for returning
  // users); remember the code so it applies after they finish onboarding.
  if (!claims?.claims) {
    const res = NextResponse.redirect(
      new URL(`/signup?next=${encodeURIComponent(`/redeem/${code}`)}`, origin),
    );
    res.cookies.set(PENDING_REDEEM_COOKIE, code, cookieOpts);
    return res;
  }

  // Signed in but no workspace yet → create one first, then come back here.
  const org = await getActiveOrg();
  if (!org) {
    const res = NextResponse.redirect(new URL(`/onboarding`, origin));
    res.cookies.set(PENDING_REDEEM_COOKIE, code, cookieOpts);
    return res;
  }

  // Resolve against the active workspace; clear the pending cookie on every exit.
  const done = (path: string) => {
    const res = NextResponse.redirect(new URL(path, origin));
    res.cookies.delete(PENDING_REDEEM_COOKIE);
    return res;
  };
  if (org.role !== "admin") return done(`/pricing?redeem=notadmin`);

  const { error } = await supabase.rpc("redeem_access_code", {
    p_raw_code: code,
    p_org: org.id,
  });
  if (error) return done(`/pricing?redeem=invalid`);
  return done(`/dashboard?redeem=ok`);
}
