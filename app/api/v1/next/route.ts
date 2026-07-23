import { NextResponse } from "next/server";
import { withAgentAuth } from "@/lib/api/agent-auth";
import { readOrgState } from "@/lib/api/agent-data";
import { content, pnum, PHASE_NAMES } from "@/lib/content/content";
import { planNextUp, isClosed } from "@/lib/content/next-up";
import { docInScope } from "@/lib/content/scope";

export const dynamic = "force-dynamic";

// GET /api/v1/next
// The agent's entry point: where this workspace stands and what to do next.
export const GET = withAgentAuth("read", async (ctx) => {
  const { status, tasks, profile } = await readOrgState(ctx);

  const acts = content.activities.map((a) => ({
    id: a.id,
    statement: a.statement,
    phaseN: pnum(a.phase),
    wave: parseInt(String(a.wave || "W1").slice(1), 10) || 1,
    ord: (a as { ord?: number }).ord || 0,
    depends: a.depends || "-",
    workstream: (a as { workstream?: string }).workstream || "tf",
    qse: a.qse,
    dur: a.dur || 0,
    subs: a.subs?.length ?? 0,
    mods: a.mods || [],
    reg: a.reg || [],
  }));

  const { scoped, currentPhase, ready, blocked } = planNextUp(
    acts,
    status,
    profile,
  );

  const done = scoped.filter((a) => status[a.id] === "Done").length;
  const na = scoped.filter((a) => status[a.id] === "N-A").length;
  const inProgress = scoped.filter((a) => status[a.id] === "In progress").length;
  const base = scoped.length - na;

  const shape = (r: { a: (typeof acts)[number]; blockers: string[] }) => ({
    id: r.a.id,
    statement: r.a.statement,
    phase: r.a.phaseN,
    workstream: r.a.workstream,
    qse: r.a.qse,
    estimatedDays: r.a.dur,
    subActivities: r.a.subs,
    tasksDone: Object.keys(tasks[r.a.id] ?? {}).length,
    status: status[r.a.id] ?? "Not started",
    blockedBy: r.blockers,
    detail: `/api/v1/activities/${r.a.id}`,
  });

  return NextResponse.json({
    workspace: { id: ctx.orgId, name: ctx.orgName, plan: ctx.plan },
    deviceProfile: {
      configured: profile !== null,
      modules: profile ? Object.keys(profile) : [],
    },
    progress: {
      inScope: scoped.length,
      done,
      inProgress,
      notApplicable: na,
      percent: base ? Math.round((done / base) * 100) : 0,
    },
    currentPhase: {
      n: currentPhase,
      name: PHASE_NAMES[currentPhase] ?? `Phase ${currentPhase}`,
      remaining: scoped.filter(
        (a) => a.phaseN === currentPhase && !isClosed(status[a.id]),
      ).length,
    },
    // Start at the top of `ready` and work down; `blocked` is informational.
    ready: ready.map(shape),
    blocked: blocked.map(shape),
    inProgressNow: scoped
      .filter((a) => status[a.id] === "In progress")
      .map((a) => ({
        id: a.id,
        statement: a.statement,
        phase: a.phaseN,
        detail: `/api/v1/activities/${a.id}`,
      })),
    documentsInScope: content.documents.filter((d) => docInScope(d, profile))
      .length,
  });
});
