import { NextResponse, type NextRequest } from "next/server";
import { hasAgenticAccess, hasFullAccess } from "@/lib/auth/access";
import { getActiveOrg } from "@/lib/auth/org";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { CLIENT_LATEST, bundleObject } from "@/lib/agent/release";

// GET /api/agent/bundle — download the Claude Desktop extension.
//
// Session-gated, entitlement-gated, and served as a 60s signed URL from a
// PRIVATE Storage bucket. Modelled on /api/docs/[docId]/download, which already
// solved this shape.
//
// Why gate a file that contains no secrets and no corpus: the download is the
// earliest possible signal that a paying workspace is actually trying to
// connect. Slice 0c's admin console can show "paying, never connected" today
// but cannot distinguish "hasn't started" from "started and got stuck" — and
// those need different phone calls. The audit row below is that distinction.
//
// It is NOT a credential. The bundle carries no key; Claude Desktop collects
// one at install time via user_config and puts it in the OS keychain. Baking a
// key in would mint a token on a GET, write a live secret to a file that
// outlives revocation, and turn a forwarded email into a workspace compromise.
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims)
    return NextResponse.redirect(
      new URL(`/login?next=${encodeURIComponent("/agent")}`, origin),
    );

  const org = await getActiveOrg();
  if (!org || !hasFullAccess(org.plan))
    return NextResponse.redirect(new URL("/pricing?bundle=locked", origin));

  // The add-on, re-read here rather than trusted from the page that linked
  // here — the same per-request check the API makes, so a lapse takes effect on
  // the next click and not at the next deploy.
  const { data: orgRow } = await supabase
    .from("organizations")
    .select("agentic_enabled, agentic_expires_at")
    .eq("id", org.id)
    .maybeSingle();

  const enabled = hasAgenticAccess({
    plan: org.plan,
    agenticEnabled: orgRow?.agentic_enabled as boolean | null,
    agenticExpiresAt: orgRow?.agentic_expires_at as string | null,
  });
  if (!enabled)
    return NextResponse.redirect(new URL("/agent?bundle=locked", origin));

  const admin = createAdminClient();
  const object = bundleObject(CLIENT_LATEST);
  const { data, error } = await admin.storage
    .from("releases")
    .createSignedUrl(object, 60, { download: object });

  if (error || !data?.signedUrl)
    // The bundle is uploaded by hand, alongside the hand-applied migrations.
    // Say which file is missing rather than a bare error: the person who sees
    // this is far more likely to be us than a customer.
    return NextResponse.redirect(new URL("/agent?bundle=unavailable", origin));

  try {
    await admin.from("audit_log").insert({
      org_id: org.id,
      actor_id: (claims.claims as { sub?: string }).sub ?? null,
      action: "agent.bundle.download",
      entity_type: "release",
      entity_id: object,
    });
  } catch {
    // never block the download on the audit trail
  }

  return NextResponse.redirect(data.signedUrl);
}
