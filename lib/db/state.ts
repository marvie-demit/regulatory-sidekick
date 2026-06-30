// Server-side reads of per-org state (replaces the 4 localStorage keys).
// Returns the SAME shapes the client components already use, so wiring is a
// matter of passing these as initial props instead of reading localStorage.

import { createClient } from "@/lib/supabase/server";

export const ENUM_TO_LABEL: Record<string, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  done: "Done",
  na: "N-A",
};
export const LABEL_TO_ENUM: Record<string, string> = {
  "Not started": "not_started",
  "In progress": "in_progress",
  Done: "done",
  "N-A": "na",
};

export type OrgState = {
  status: Record<string, string>; // mdsi_ck — { activityId: "In progress" }
  tasks: Record<string, Record<number, 1>>; // mdsi_tasks — { activityId: { 0: 1 } }
  quiz: Record<number, number>; // mdsi_qz — { phase: bestScore }
  profile: Record<string, number> | null; // mdsi_profile — { code: 1 } | null
};

export const EMPTY_STATE: OrgState = {
  status: {},
  tasks: {},
  quiz: {},
  profile: null,
};

export async function getOrgState(orgId: string): Promise<OrgState> {
  const supabase = await createClient();
  const [st, tk, qz, dp] = await Promise.all([
    supabase
      .from("activity_status")
      .select("activity_id,status")
      .eq("org_id", orgId),
    supabase
      .from("task_completion")
      .select("activity_id,step_index")
      .eq("org_id", orgId),
    supabase.from("quiz_score").select("phase,best_score").eq("org_id", orgId),
    supabase
      .from("org_device_profile")
      .select("configured,modules")
      .eq("org_id", orgId)
      .maybeSingle(),
  ]);

  const status: Record<string, string> = {};
  (st.data as { activity_id: string; status: string }[] | null)?.forEach((r) => {
    status[r.activity_id] = ENUM_TO_LABEL[r.status] ?? "Not started";
  });

  const tasks: Record<string, Record<number, 1>> = {};
  (
    tk.data as { activity_id: string; step_index: number }[] | null
  )?.forEach((r) => {
    (tasks[r.activity_id] = tasks[r.activity_id] || {})[r.step_index] = 1;
  });

  const quiz: Record<number, number> = {};
  (qz.data as { phase: number; best_score: number }[] | null)?.forEach((r) => {
    quiz[r.phase] = r.best_score;
  });

  let profile: Record<string, number> | null = null;
  const dpRow = dp.data as { configured: boolean; modules: string[] } | null;
  if (dpRow?.configured) {
    profile = {};
    (dpRow.modules || []).forEach((m) => {
      profile![m] = 1;
    });
  }

  return { status, tasks, quiz, profile };
}
