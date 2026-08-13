import { NextResponse } from "next/server";
import { withAgentAuth, agentError } from "@/lib/api/agent-auth";

export const dynamic = "force-dynamic";

// GET /api/v1/documents/drafts
//
// Every draft this workspace has recorded — path, size, open-question count,
// and whether a human has reviewed it. Metadata only, because that is all the
// table holds (migration 0019).
//
// Why an agent needs this even though it can see its own folder: the folder is
// one machine's view. A colleague drafting on their laptop, or the same person
// on a second machine, leaves no trace locally — so a resuming agent would
// redraft work that exists and quietly overwrite someone's edits. This is the
// only way to know that before writing.
//
// Scoped to `read` rather than `write:drafts`: reading back what your own
// workspace recorded is not a write, and a key that can read the plan should be
// able to see the plan's progress. Note the asymmetry is deliberate — reporting
// a draft is the privileged half.
export const GET = withAgentAuth("read", async (ctx) => {
  const { data, error } = await ctx.db
    .from("document_drafts")
    .select("doc_id, activity_id, path, bytes, open_questions, warnings, validated_at, reviewed_at")
    .eq("org_id", ctx.orgId)
    .order("validated_at", { ascending: false });

  if (error) {
    // An unapplied 0019 is not the agent's problem and must not read as one.
    if (error.code === "42P01")
      return NextResponse.json({ drafts: [], available: false });
    return agentError(500, error.message);
  }

  return NextResponse.json({
    available: true,
    drafts: (data ?? []).map((r) => ({
      docId: r.doc_id,
      activityId: r.activity_id,
      path: r.path,
      bytes: r.bytes,
      openQuestions: r.open_questions,
      warnings: r.warnings,
      draftedAt: r.validated_at,
      reviewed: !!r.reviewed_at,
    })),
  });
});
