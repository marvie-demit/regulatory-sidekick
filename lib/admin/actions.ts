"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { randomBytes, createHash } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdmin } from "@/lib/auth/platform";

type Res = {
  error?: string;
  message?: string;
  code?: string;
  codeUrl?: string;
};

async function gate(): Promise<{ uid: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };
  if (!(await isPlatformAdmin())) return { error: "Not authorized." };
  return { uid: user.id };
}

export async function createAccessCode(_prev: Res, formData: FormData): Promise<Res> {
  const g = await gate();
  if ("error" in g) return { error: g.error };

  const plan = String(formData.get("plan") || "full");
  if (!["full", "enterprise"].includes(plan)) return { error: "Invalid plan." };

  const grantDaysRaw = String(formData.get("grantDays") || "365").trim();
  const grantDays =
    grantDaysRaw === "" || grantDaysRaw === "0" ? null : parseInt(grantDaysRaw, 10);
  if (grantDays !== null && (!Number.isFinite(grantDays) || grantDays < 1 || grantDays > 3650))
    return { error: "Duration must be 1–3650 days (or blank for no expiry)." };

  const maxUses = Math.max(1, parseInt(String(formData.get("maxUses") || "1"), 10) || 1);
  const note = String(formData.get("note") || "").trim().slice(0, 200) || null;

  const raw = "RS-" + randomBytes(15).toString("base64url");
  const codeHash = createHash("sha256").update(raw).digest("hex");

  const admin = createAdminClient();
  const { error } = await admin.from("access_codes").insert({
    code_hash: codeHash,
    plan,
    grant_days: grantDays,
    max_uses: maxUses,
    note,
    created_by: g.uid,
  });
  if (error) return { error: error.message };

  const hdrs = await headers();
  const origin =
    hdrs.get("origin") ?? `http://${hdrs.get("host") ?? "localhost:3100"}`;
  revalidatePath("/admin");
  return {
    message: "Access code created — copy it now, it isn't shown again.",
    code: raw,
    codeUrl: `${origin}/redeem/${raw}`,
  };
}

export async function setOrgPlan(_prev: Res, formData: FormData): Promise<Res> {
  const g = await gate();
  if ("error" in g) return { error: g.error };

  const orgId = String(formData.get("orgId") || "");
  const plan = String(formData.get("plan") || "explore");
  if (!orgId) return { error: "Missing organization." };
  if (!["explore", "full", "enterprise"].includes(plan))
    return { error: "Invalid plan." };

  const days = parseInt(String(formData.get("grantDays") || "0"), 10);
  const expiresAt =
    plan !== "explore" && Number.isFinite(days) && days > 0
      ? new Date(Date.now() + days * 86400000).toISOString()
      : null;

  const admin = createAdminClient();
  const { error } = await admin
    .from("organizations")
    .update({ plan, plan_expires_at: expiresAt })
    .eq("id", orgId);
  if (error) return { error: error.message };

  await admin.from("audit_log").insert({
    org_id: orgId,
    actor_id: g.uid,
    action: "plan.set_by_platform_admin",
    entity_type: "organization",
    entity_id: orgId,
    detail: { plan, plan_expires_at: expiresAt },
  });
  revalidatePath("/admin");
  return {
    message: `Set to ${plan}${expiresAt ? ` until ${expiresAt.slice(0, 10)}` : ""}.`,
  };
}

export async function revokeAccessCode(_prev: Res, formData: FormData): Promise<Res> {
  const g = await gate();
  if ("error" in g) return { error: g.error };
  const id = String(formData.get("codeId") || "");
  if (!id) return { error: "Missing code." };
  const admin = createAdminClient();
  const { error } = await admin.from("access_codes").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin");
  return { message: "Code deleted." };
}
