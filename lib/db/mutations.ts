"use server";

import { getActiveOrg } from "@/lib/auth/org";
import { LABEL_TO_ENUM } from "@/lib/db/state";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function ctx() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const uid = data?.claims?.sub as string | undefined;
  const org = await getActiveOrg();
  if (!org || !uid) throw new Error("Not authorized");
  return { supabase, uid, orgId: org.id };
}

// Audit rows are written with the SERVICE ROLE. Direct INSERT to audit_log is
// revoked for end users (migration 0008) so the trail can't be forged; the
// org_id/actor_id here come from the validated ctx(), not the client. Best-
// effort — an audit failure must never break the user's action.
async function audit(
  orgId: string,
  uid: string,
  action: string,
  entityType: string,
  entityId: string | null,
  detail?: Record<string, unknown>,
) {
  try {
    const admin = createAdminClient();
    await admin.from("audit_log").insert({
      org_id: orgId,
      actor_id: uid,
      action,
      entity_type: entityType,
      entity_id: entityId,
      detail: detail ?? null,
    });
  } catch {}
}

const NOW = () => new Date().toISOString();

export async function setActivityStatus(activityId: string, label: string) {
  const { supabase, uid, orgId } = await ctx();
  const status = LABEL_TO_ENUM[label] ?? "not_started";
  const { error } = await supabase.from("activity_status").upsert(
    { org_id: orgId, activity_id: activityId, status, updated_by: uid, updated_at: NOW() },
    { onConflict: "org_id,activity_id" },
  );
  if (error) throw new Error(error.message);
  await audit(orgId, uid, "status.set", "activity", activityId, { status });
}

export async function bulkSetStatus(activityIds: string[], label: string) {
  const { supabase, uid, orgId } = await ctx();
  if (!activityIds.length) return;
  const status = LABEL_TO_ENUM[label] ?? "not_started";
  const rows = activityIds.map((activity_id) => ({
    org_id: orgId,
    activity_id,
    status,
    updated_by: uid,
    updated_at: NOW(),
  }));
  const { error } = await supabase
    .from("activity_status")
    .upsert(rows, { onConflict: "org_id,activity_id" });
  if (error) throw new Error(error.message);
  await audit(orgId, uid, "status.bulk", "activity", null, {
    count: activityIds.length,
    status,
  });
}

// Toggle a granular task. Checking the first task on a "not started" activity
// promotes it to "in progress" (server-side, same rule as before). Returns
// whether the promotion happened so the client can reflect it. Every write is
// error-checked: a failed/RLS-blocked write throws so the client's optimistic
// update rolls back instead of silently dropping the change.
export async function toggleTask(
  activityId: string,
  stepIndex: number,
  done: boolean,
): Promise<{ promoted: boolean }> {
  const { supabase, uid, orgId } = await ctx();
  if (done) {
    const { error } = await supabase.from("task_completion").upsert(
      { org_id: orgId, activity_id: activityId, step_index: stepIndex, updated_by: uid, updated_at: NOW() },
      { onConflict: "org_id,activity_id,step_index" },
    );
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("task_completion")
      .delete()
      .eq("org_id", orgId)
      .eq("activity_id", activityId)
      .eq("step_index", stepIndex);
    if (error) throw new Error(error.message);
  }

  let promoted = false;
  if (done) {
    const { data: cur, error: selError } = await supabase
      .from("activity_status")
      .select("status")
      .eq("org_id", orgId)
      .eq("activity_id", activityId)
      .maybeSingle();
    if (selError) throw new Error(selError.message);
    const status = (cur as { status: string } | null)?.status;
    if (!status || status === "not_started") {
      const { error } = await supabase.from("activity_status").upsert(
        { org_id: orgId, activity_id: activityId, status: "in_progress", updated_by: uid, updated_at: NOW() },
        { onConflict: "org_id,activity_id" },
      );
      if (error) throw new Error(error.message);
      promoted = true;
    }
  }
  return { promoted };
}

export async function resetAllState() {
  const { supabase, uid, orgId } = await ctx();
  const { error: statusError } = await supabase
    .from("activity_status")
    .delete()
    .eq("org_id", orgId);
  if (statusError) throw new Error(statusError.message);
  const { error: taskError } = await supabase
    .from("task_completion")
    .delete()
    .eq("org_id", orgId);
  if (taskError) throw new Error(taskError.message);
  await audit(orgId, uid, "state.reset", "org", orgId);
}

export async function setQuizBest(phase: number, score: number) {
  const { supabase, uid, orgId } = await ctx();
  const { data: cur, error: selError } = await supabase
    .from("quiz_score")
    .select("best_score")
    .eq("org_id", orgId)
    .eq("phase", phase)
    .maybeSingle();
  if (selError) throw new Error(selError.message);
  const best = (cur as { best_score: number } | null)?.best_score ?? -1;
  if (score > best) {
    const { error } = await supabase.from("quiz_score").upsert(
      { org_id: orgId, phase, best_score: score, updated_by: uid, updated_at: NOW() },
      { onConflict: "org_id,phase" },
    );
    if (error) throw new Error(error.message);
  }
}

// modules = null → not configured (show everything); [] → Core only; [..] → those modules.
export async function setDeviceProfile(modules: string[] | null) {
  const { supabase, uid, orgId } = await ctx();
  const { error } = await supabase.from("org_device_profile").upsert(
    {
      org_id: orgId,
      configured: modules !== null,
      modules: modules ?? [],
      updated_by: uid,
      updated_at: NOW(),
    },
    { onConflict: "org_id" },
  );
  if (error) throw new Error(error.message);
  await audit(orgId, uid, "profile.set", "org", orgId, {
    configured: modules !== null,
    modules: modules ?? [],
  });
}
