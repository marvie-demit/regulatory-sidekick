import { NextResponse } from "next/server";
import { withAgentAuth, auditAgent, agentError } from "@/lib/api/agent-auth";
import { readOrgState } from "@/lib/api/agent-data";
import {
  getActivity,
  pnum,
  expandRefs,
  byDocId,
  PHASE_NAMES,
} from "@/lib/content/content";
import { actInScope } from "@/lib/content/scope";
import { LABEL_TO_ENUM } from "@/lib/db/state";

export const dynamic = "force-dynamic";

type Route = { params: Promise<{ id: string }> };

// depends/leads are comma-separated ACTIVITY ids ("QMN.establish, DOC.control"),
// not the doc-ref shorthand expandRefs() parses — split them plainly.
const idList = (s?: string) =>
  (s || "")
    .split(",")
    .map((x) => x.trim())
    .filter((x) => x && x !== "-");

// Flat task index — MUST match the UI's flatMap over how2 groups, since that's
// what task_completion.step_index means (see components/content/ActivityTasks).
function flatTasks(how2: { role: string; steps: { t: string; d: string }[] }[]) {
  const out: { index: number; role: string; task: string; detail: string }[] = [];
  let i = 0;
  for (const g of how2 ?? [])
    for (const s of g.steps ?? [])
      out.push({ index: i++, role: g.role, task: s.t, detail: s.d });
  return out;
}

// GET /api/v1/activities/:id — everything needed to actually do the activity.
export const GET = withAgentAuth<Route>("read", async (ctx, _req, route) => {
  const { id } = await route.params;
  const a = getActivity(id);
  if (!a) return agentError(404, `No activity "${id}".`);

  const { status, tasks, profile } = await readOrgState(ctx);
  const doneIdx = tasks[a.id] ?? {};
  const steps = flatTasks(a.how2 ?? []);

  return NextResponse.json({
    workspace: { id: ctx.orgId, name: ctx.orgName },
    id: a.id,
    statement: a.statement,
    phase: pnum(a.phase),
    phaseName: PHASE_NAMES[pnum(a.phase)] ?? "",
    workstream: (a as { workstream?: string }).workstream || "tf",
    qse: a.qse,
    inScope: actInScope(a, profile),
    status: status[a.id] ?? "Not started",
    estimatedDays: a.dur ?? 0,
    why: a.why ?? "",
    what: a.what ?? "",
    startLean: a.lean
      ? { summary: a.lean.start, bullets: a.lean.startDetail ?? [] }
      : null,
    evolve: a.lean
      ? { summary: a.lean.evolve, bullets: a.lean.evolveDetail ?? [] }
      : null,
    tasks: steps.map((s) => ({ ...s, done: !!doneIdx[s.index] })),
    tasksDone: steps.filter((s) => doneIdx[s.index]).length,
    tasksTotal: steps.length,
    records: a.records ?? [],
    tips: a.tips ?? [],
    clauses: a.clausemap ?? [],
    documents: expandRefs(a.documents)
      .map((d) => byDocId[d])
      .filter(Boolean)
      .map((d) => ({ id: d.id, title: d.title, type: d.cls })),
    dependsOn: idList(a.depends),
    leadsTo: idList(a.leads),
    subActivities: (a.subs ?? []).map((s) => ({
      title: s.t,
      who: s.who,
      why: s.why,
      what: s.what,
      how: s.how ?? [],
    })),
  });
});

// PATCH /api/v1/activities/:id — the agent reporting progress.
// Body: { "status"?: "In progress" | "Done" | "N-A" | "Not started",
//         "tasks"?: { "0": true, "3": false } }
export const PATCH = withAgentAuth<Route>(
  "write:status",
  async (ctx, req, route) => {
    const { id } = await route.params;
    if (!getActivity(id)) return agentError(404, `No activity "${id}".`);

    let body: { status?: unknown; tasks?: unknown };
    try {
      body = await req.json();
    } catch {
      return agentError(400, "Body must be JSON.");
    }
    if (body.status === undefined && body.tasks === undefined)
      return agentError(400, "Nothing to change — send `status` and/or `tasks`.");

    const now = new Date().toISOString();
    const changed: Record<string, unknown> = {};

    // --- sub-tasks ---------------------------------------------------------
    if (body.tasks !== undefined) {
      if (typeof body.tasks !== "object" || body.tasks === null)
        return agentError(400, "`tasks` must be an object of index → boolean.");
      const entries = Object.entries(body.tasks as Record<string, unknown>);
      const bad = entries.find(
        ([k, v]) => !/^\d+$/.test(k) || typeof v !== "boolean",
      );
      if (bad) return agentError(400, "`tasks` keys must be indexes, values booleans.");

      const on = entries.filter(([, v]) => v === true).map(([k]) => Number(k));
      const off = entries.filter(([, v]) => v === false).map(([k]) => Number(k));

      if (on.length) {
        const { error } = await ctx.db.from("task_completion").upsert(
          on.map((step_index) => ({
            org_id: ctx.orgId,
            activity_id: id,
            step_index,
            updated_by: ctx.createdBy,
            updated_at: now,
          })),
          { onConflict: "org_id,activity_id,step_index" },
        );
        if (error) return agentError(500, error.message);
      }
      if (off.length) {
        const { error } = await ctx.db
          .from("task_completion")
          .delete()
          .eq("org_id", ctx.orgId)
          .eq("activity_id", id)
          .in("step_index", off);
        if (error) return agentError(500, error.message);
      }
      changed.tasks = { checked: on, unchecked: off };
    }

    // --- status ------------------------------------------------------------
    let statusLabel = typeof body.status === "string" ? body.status : null;

    // Same rule as the UI: ticking a task on a not-started activity promotes it.
    if (!statusLabel && (changed.tasks as { checked: number[] })?.checked?.length) {
      const { data: cur } = await ctx.db
        .from("activity_status")
        .select("status")
        .eq("org_id", ctx.orgId)
        .eq("activity_id", id)
        .maybeSingle();
      const s = (cur as { status: string } | null)?.status;
      if (!s || s === "not_started") statusLabel = "In progress";
    }

    if (statusLabel) {
      const enumValue = LABEL_TO_ENUM[statusLabel];
      if (!enumValue)
        return agentError(
          400,
          `Unknown status "${statusLabel}". Use: ${Object.keys(LABEL_TO_ENUM).join(", ")}.`,
        );
      const { error } = await ctx.db.from("activity_status").upsert(
        {
          org_id: ctx.orgId,
          activity_id: id,
          status: enumValue,
          updated_by: ctx.createdBy,
          updated_at: now,
        },
        { onConflict: "org_id,activity_id" },
      );
      if (error) return agentError(500, error.message);
      changed.status = statusLabel;
    }

    await auditAgent(ctx, "status.set", "activity", id, changed);

    return NextResponse.json({ ok: true, id, changed });
  },
);
