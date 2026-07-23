// Per-workspace reads for the agent API. Mirrors lib/db/state.ts, but the
// caller is a machine (no user session), so it reads with the service role —
// which is exactly why every query here is scoped by ctx.orgId, and ctx.orgId
// only ever comes from the token row (see lib/api/agent-auth.ts).

import { ENUM_TO_LABEL, type OrgState } from "@/lib/db/state";
import type { AgentCtx } from "@/lib/api/agent-auth";

export async function readOrgState(ctx: AgentCtx): Promise<OrgState> {
  const [st, tk, dp] = await Promise.all([
    ctx.db
      .from("activity_status")
      .select("activity_id,status")
      .eq("org_id", ctx.orgId),
    ctx.db
      .from("task_completion")
      .select("activity_id,step_index")
      .eq("org_id", ctx.orgId),
    ctx.db
      .from("org_device_profile")
      .select("configured,modules")
      .eq("org_id", ctx.orgId)
      .maybeSingle(),
  ]);

  const status: Record<string, string> = {};
  (st.data as { activity_id: string; status: string }[] | null)?.forEach((r) => {
    status[r.activity_id] = ENUM_TO_LABEL[r.status] ?? "Not started";
  });

  const tasks: Record<string, Record<number, 1>> = {};
  (tk.data as { activity_id: string; step_index: number }[] | null)?.forEach(
    (r) => {
      (tasks[r.activity_id] = tasks[r.activity_id] || {})[r.step_index] = 1;
    },
  );

  let profile: Record<string, number> | null = null;
  const dpRow = dp.data as { configured: boolean; modules: string[] } | null;
  if (dpRow?.configured) {
    profile = {};
    (dpRow.modules || []).forEach((m) => {
      profile![m] = 1;
    });
  }

  return { status, tasks, quiz: {}, profile };
}
