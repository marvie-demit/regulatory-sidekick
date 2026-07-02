import { NextResponse, type NextRequest } from "next/server";
import { hasFullAccess } from "@/lib/auth/access";
import { getActiveOrg } from "@/lib/auth/org";
import { docFile } from "@/lib/docs";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// GET /api/docs/<id>/download — full-access only. Gates server-side, then hands
// back a 60s signed URL to the private Storage object (never a public path).
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ docId: string }> },
) {
  const { docId } = await ctx.params;
  const origin = req.nextUrl.origin;

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) {
    return NextResponse.redirect(
      new URL(`/login?next=${encodeURIComponent(`/library/${docId}`)}`, origin),
    );
  }

  const org = await getActiveOrg();
  if (!org || !hasFullAccess(org.plan)) {
    return NextResponse.redirect(new URL(`/pricing?download=locked`, origin));
  }

  const file = docFile(docId);
  if (!file) {
    return NextResponse.redirect(
      new URL(`/library/${docId}?download=unavailable`, origin),
    );
  }

  // Content-Disposition filenames must be ASCII — a non-ASCII char (e.g. the
  // em dash we used as a separator) leaks in as percent-encoded bytes. Fold to
  // safe ASCII so the saved filename is clean.
  const downloadName = file.name
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "-")
    .replace(/\s{2,}/g, " ")
    .trim();
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from("documents")
    .createSignedUrl(`${docId}.${file.ext}`, 60, { download: downloadName });
  if (error || !data?.signedUrl) {
    return NextResponse.redirect(
      new URL(`/library/${docId}?download=error`, origin),
    );
  }

  // best-effort audit trail (who downloaded what). Written with the service
  // role — direct member INSERT to audit_log is revoked (migration 0008).
  try {
    await admin.from("audit_log").insert({
      org_id: org.id,
      actor_id: (claims.claims as { sub?: string }).sub ?? null,
      action: "document.download",
      entity_type: "document",
      entity_id: docId,
    });
  } catch {
    // ignore audit failures
  }

  return NextResponse.redirect(data.signedUrl);
}
