"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/auth/org";

type Res = { error?: string; message?: string };

// Org-admin redeems an access code for their active workspace.
export async function redeemCode(_prev: Res, formData: FormData): Promise<Res> {
  const raw = String(formData.get("code") || "").trim();
  if (!raw) return { error: "Enter your access code." };

  const org = await getActiveOrg();
  if (!org) return { error: "No active organization." };
  if (org.role !== "admin")
    return { error: "Only an admin can redeem a code for the workspace." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("redeem_access_code", {
    p_raw_code: raw,
    p_org: org.id,
  });
  if (error) return { error: error.message };

  revalidatePath("/", "layout");

  // A code can now grant a licence, agent access, or both (0023), so the
  // message has to name what was actually given. `plan` is null on an
  // agent-only code — defaulting it to "full" would tell a customer they had
  // been given something they had not.
  const r = (data ?? {}) as { plan?: string | null; agentic?: boolean };
  const granted: string[] = [];
  if (r.plan) granted.push(r.plan === "enterprise" ? "Enterprise access" : "Full access");
  if (r.agentic) granted.push("Agent access");

  return {
    message: granted.length
      ? `Success. ${org.name} now has ${granted.join(" and ")}.`
      : `Success. ${org.name} is set up.`,
  };
}
