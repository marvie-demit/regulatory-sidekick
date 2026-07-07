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
  linkUrl?: string;
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
  const targetOrgId = String(formData.get("targetOrgId") || "").trim() || null;

  // Redeem-by window: the code self-expires if not redeemed in time. Field absent
  // (org-row quick "Create code") -> default 14 days; blank or 0 -> no deadline.
  const redeemRaw = formData.get("redeemDays");
  const redeemDays =
    redeemRaw === null
      ? 14
      : String(redeemRaw).trim() === "" || String(redeemRaw).trim() === "0"
        ? null
        : parseInt(String(redeemRaw), 10);
  if (
    redeemDays !== null &&
    (!Number.isFinite(redeemDays) || redeemDays < 1 || redeemDays > 365)
  )
    return { error: "Redeem-by window must be 1–365 days (or blank for no deadline)." };
  const expiresAt =
    redeemDays !== null
      ? new Date(Date.now() + redeemDays * 86_400_000).toISOString()
      : null;

  const raw = "RS-" + randomBytes(15).toString("base64url");
  const codeHash = createHash("sha256").update(raw).digest("hex");

  const admin = createAdminClient();
  const base = {
    code_hash: codeHash,
    plan,
    grant_days: grantDays,
    max_uses: maxUses,
    expires_at: expiresAt,
    note,
    created_by: g.uid,
  };
  // Prefer the full row (raw code for re-display + optional org lock); fall back
  // to hash-only if those columns aren't present yet (migrations 0005 / 0006).
  const full = {
    ...base,
    code: raw,
    ...(targetOrgId ? { target_org_id: targetOrgId } : {}),
  };
  let ins = await admin.from("access_codes").insert(full);
  if (ins.error) {
    // The hash-only fallback also drops target_org_id — never silently downgrade
    // an org-locked code into a generic one that any org could redeem.
    if (targetOrgId)
      return {
        error:
          "Could not create an org-locked code (ensure migrations 0005 & 0006 are applied): " +
          ins.error.message,
      };
    ins = await admin.from("access_codes").insert(base);
  }
  if (ins.error) return { error: ins.error.message };

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

// Generate a one-time auth link for a user (recovery or magic sign-in), for an
// admin to copy and send. We use admin.generateLink (token_hash) and route the
// user through /auth/confirm (verifyOtp) rather than resetPasswordForEmail /
// signInWithOtp: those attach a PKCE code_verifier to the *initiator's* browser,
// so an admin-triggered email link would fail in the recipient's browser. A
// token_hash link verifies server-side with no browser dependency. Links are
// single-use and expire per the project's OTP lifetime (~1 hour by default).
export async function adminAuthLink(_prev: Res, formData: FormData): Promise<Res> {
  const g = await gate();
  if ("error" in g) return { error: g.error };

  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  const kind = String(formData.get("kind") || "");
  if (!email) return { error: "Enter the user's email." };
  const type =
    kind === "recovery" ? "recovery" : kind === "magiclink" ? "magiclink" : null;
  if (!type) return { error: "Choose a recovery or magic-link." };

  const admin = createAdminClient();
  const params =
    type === "recovery"
      ? ({ type: "recovery", email } as const)
      : ({ type: "magiclink", email } as const);
  const { data, error } = await admin.auth.admin.generateLink(params);
  if (error) {
    // recovery/magiclink require an existing user
    return {
      error: /not.*found|user.*exist/i.test(error.message)
        ? `No account found for ${email}.`
        : error.message,
    };
  }
  const hashed = data?.properties?.hashed_token;
  if (!hashed) return { error: "Could not generate a link — try again." };

  const hdrs = await headers();
  const origin =
    hdrs.get("origin") ?? `http://${hdrs.get("host") ?? "localhost:3100"}`;
  const next = type === "recovery" ? "/reset-password" : "/dashboard";
  const linkUrl = `${origin}/auth/confirm?token_hash=${hashed}&type=${type}&next=${encodeURIComponent(next)}`;

  return {
    message:
      type === "recovery"
        ? `Password-recovery link ready for ${email}. Copy it and send it to them — it lets them set a new password. Single-use, expires in ~1 hour.`
        : `Magic sign-in link ready for ${email}. Copy it and send it to them — it signs them straight in. Single-use, expires in ~1 hour.`,
    linkUrl,
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

// Permanently delete an org: cascade-wipes every per-org table via the DB FKs,
// and purges the org's evidence files from Storage (which does NOT cascade).
// Requires the exact org name typed back as confirmation. Irreversible.
export async function deleteOrg(_prev: Res, formData: FormData): Promise<Res> {
  const g = await gate();
  if ("error" in g) return { error: g.error };

  const orgId = String(formData.get("orgId") || "");
  const confirmName = String(formData.get("confirmName") || "").trim();
  if (!orgId) return { error: "Missing organization." };

  const admin = createAdminClient();
  const { data: org, error: fErr } = await admin
    .from("organizations")
    .select("name")
    .eq("id", orgId)
    .single();
  if (fErr || !org) return { error: "Organization not found." };
  if (confirmName !== org.name)
    return { error: "The typed name doesn't match — nothing deleted." };

  // Storage doesn't cascade with the DB delete, so purge the org's evidence
  // folder first. Best-effort: a leftover file must not block the delete.
  try {
    const bucket = admin.storage.from("evidence");
    const prefix = `org/${orgId}`;
    const { data: folders } = await bucket.list(prefix, { limit: 1000 });
    const paths: string[] = [];
    for (const f of folders ?? []) {
      const sub = `${prefix}/${f.name}`;
      const { data: files } = await bucket.list(sub, { limit: 1000 });
      (files ?? []).forEach((x) => paths.push(`${sub}/${x.name}`));
    }
    if (paths.length) await bucket.remove(paths);
  } catch {
    // ignore — orphaned evidence is preferable to a half-completed delete
  }

  // Cascades memberships, activity_status, task_completion, org_device_profile,
  // quiz_score, evidence rows, invitations, code_redemptions, audit_log.
  const { error } = await admin.from("organizations").delete().eq("id", orgId);
  if (error) return { error: error.message };

  revalidatePath("/admin");
  return { message: `Deleted "${org.name}" and all its data.` };
}
