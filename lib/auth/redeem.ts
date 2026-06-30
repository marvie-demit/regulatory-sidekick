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
  const plan = (data as { plan?: string } | null)?.plan ?? "full";
  return {
    message: `Success — ${org.name} now has ${plan === "enterprise" ? "Enterprise" : "Full"} access.`,
  };
}
