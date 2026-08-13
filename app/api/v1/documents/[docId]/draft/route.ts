import { NextResponse } from "next/server";
import { withAgentAuth, auditAgent, agentError } from "@/lib/api/agent-auth";
import { readOrgState } from "@/lib/api/agent-data";
import { byDocId, docActivities } from "@/lib/content/content";
import { docInScope } from "@/lib/content/scope";

export const dynamic = "force-dynamic";

type Route = { params: Promise<{ docId: string }> };

/**
 * Normalise a path reported by an agent.
 *
 * The MCP server runs on the customer's machine, so on Windows it produces
 * "20_Drafts\AES\AES-SOP-01.html". Stored as-is, that is a second spelling of a
 * path we already have a row for, and the unique constraint on (org_id, doc_id)
 * would not catch it — the badge would flicker between two paths depending on
 * which machine last drafted.
 */
function normalisePath(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/{2,}/g, "/").trim();
}

// PUT /api/v1/documents/:docId/draft
//
// Records that a draft EXISTS. Path, size, open-question count — never content.
// There is no content column to write to (migration 0019) and the product claim
// that "your documents never leave your machine" depends on it staying that way.
//
// What this endpoint can and cannot verify, stated plainly: it CANNOT confirm
// the draft passes its contract, because it never sees the draft. `ok` is the
// agent's report. The actual gate is local and does not depend on this call —
// save_draft refuses to write a failing draft to disk at all, so a rejected
// draft has no path to report in the first place. Requiring ok === true here
// stops a well-behaved client from recording a failure as an achievement; it is
// not a defence against a hostile one, and nothing downstream should treat it
// as one.
export const PUT = withAgentAuth<Route>(
  "write:drafts",
  async (ctx, req, route) => {
    const { docId } = await route.params;
    const doc = byDocId[docId];

    const { profile } = await readOrgState(ctx);

    // 404 rather than 403 for an out-of-scope document, matching the template
    // endpoint: a 403 would confirm what exists outside this device profile.
    if (!doc || !docInScope(doc, profile))
      return agentError(404, `No document "${docId}".`);

    let body: {
      path?: unknown;
      bytes?: unknown;
      ok?: unknown;
      warnings?: unknown;
      openQuestions?: unknown;
      activityId?: unknown;
      client?: unknown;
    };
    try {
      body = await req.json();
    } catch {
      return agentError(400, "Body must be JSON.");
    }

    if (typeof body.path !== "string" || !body.path.trim())
      return agentError(400, "`path` is required — where the draft landed, relative to the QMS root.");

    if (body.ok !== true)
      return agentError(
        422,
        "Only a draft that passes its own contract is recorded. Fix the validation errors, save again, then report it.",
      );

    const path = normalisePath(body.path);

    // Defence in depth with document_drafts_path_chk. The DB constraint is the
    // wall; this exists to return a sentence an agent can act on instead of a
    // constraint-violation string.
    if (!path.startsWith("20_Drafts/") || path.includes("..") || path.length > 400)
      return agentError(
        400,
        `"${body.path}" is not a draft path. Drafts live under 20_Drafts/ — 00_Controlled/ and 10_Records/ are never written by an agent.`,
      );

    const num = (v: unknown, fallback = 0) =>
      typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : fallback;

    const activityId =
      typeof body.activityId === "string" && body.activityId.trim()
        ? body.activityId.trim().slice(0, 64)
        : (docActivities(docId)[0] ?? null);

    const now = new Date().toISOString();
    const row = {
      org_id: ctx.orgId,
      doc_id: docId,
      activity_id: activityId,
      path,
      bytes: num(body.bytes),
      open_questions: num(body.openQuestions),
      warnings: num(body.warnings),
      validated_at: now,
      client: typeof body.client === "string" ? body.client.slice(0, 64) : null,
      agent_token_id: ctx.tokenId,
      updated_at: now,
    };

    const { error } = await ctx.db
      .from("document_drafts")
      .upsert(row, { onConflict: "org_id,doc_id" });

    if (error) {
      // An unapplied 0019. Say which migration, because the person who sees
      // this is an operator, not the agent.
      if (error.code === "42P01")
        return agentError(
          503,
          "Draft reporting is not available on this deployment yet (migration 0019 not applied). Your draft is saved on disk — nothing is lost.",
        );
      return agentError(500, error.message);
    }

    // Re-drafting updates in place, so this row does not double-count. The
    // audit log is where the history lives.
    await auditAgent(ctx, "document.draft", "document", docId, {
      path,
      bytes: row.bytes,
      openQuestions: row.open_questions,
    });

    return NextResponse.json({
      ok: true,
      docId,
      path,
      activityId,
      recorded: now,
    });
  },
);
