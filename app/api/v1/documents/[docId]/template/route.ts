import { NextResponse } from "next/server";
import { withAgentAuth, auditAgent, agentError } from "@/lib/api/agent-auth";
import { readOrgState } from "@/lib/api/agent-data";
import { byDocId, docActivities } from "@/lib/content/content";
import { docInScope } from "@/lib/content/scope";
import { buildPromptVars, allowedClauses } from "@/lib/docgen/prompt-vars";
import { renderDocPrompt } from "@/lib/docgen/prompt-template";

export const dynamic = "force-dynamic";

type Route = { params: Promise<{ docId: string }> };

// GET /api/v1/documents/:docId/template
//
// The blank fragment, the contract derived from it, and the prompt for drafting
// it — one call, one audit row.
//
// This endpoint is why the corpus is NOT bundled into the agent package: served
// here it inherits the licence gate, the agentic entitlement (re-checked per
// request, so revocation is immediate), the rate budgets, and an audit row per
// template fetched. A published tarball would hand over all 275 files with no
// account, no trace, and — the part that decides it — would keep working after
// access was switched off.
export const GET = withAgentAuth<Route>(
  "read:documents",
  async (ctx, _req, route) => {
    const { docId } = await route.params;
    const doc = byDocId[docId];

    const { profile } = await readOrgState(ctx);

    // 404 rather than 403 for an out-of-scope document: a 403 would confirm
    // what exists outside this workspace's device profile. An MDR-route
    // workspace should not be able to enumerate the IVDR corpus.
    if (!doc || !docInScope(doc, profile))
      return agentError(404, `No document "${docId}".`);

    const vars = buildPromptVars({ docId, profile });
    if (!vars) return agentError(404, `No document "${docId}".`);

    await auditAgent(ctx, "document.template", "document", docId, {
      title: doc.title,
    });

    const c = vars.contract;
    return NextResponse.json({
      id: doc.id,
      title: doc.title,
      cls: doc.cls,
      domain: doc.domain,
      module: doc.module,
      reg: doc.reg ?? [],
      fillMode: vars.fillMode,
      role: vars.role,
      producedIn: vars.producedIn,
      implementedBy: docActivities(docId),
      /** "A" = has a header band (246 docs), "B" = a register (29) */
      skeleton: c.hasHeaderband ? "A" : "B",
      html: vars.html,
      contract: {
        h1Text: c.h1Text,
        hasHeaderband: c.hasHeaderband,
        headerbandRows: c.headerbandRows.map((r) => r.label),
        outline: c.outline,
        placeholders: c.placeholders,
        guidanceBlocks: c.guidanceCount,
        manualTables: c.manualTableCount,
        tables: c.tables.map((t) => ({
          cls: t.cls,
          columns: t.headerCells,
          bodyRows: t.bodyRows,
          bracketCells: t.bracketAt.length,
          blankRegisterRow: t.emptyregColspan !== null,
        })),
      },
      allowedClauses: allowedClauses(vars.activity?.clauses ?? []),
      prompt: renderDocPrompt(vars),
    });
  },
);
