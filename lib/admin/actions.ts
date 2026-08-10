"use server";

import { requestOrigin } from "@/lib/http/origin";
import { revalidatePath } from "next/cache";
import { createHash, randomBytes, randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdmin } from "@/lib/auth/platform";
import { generateCodes } from "@/lib/partners/codes";

type Res = {
  error?: string;
  message?: string;
  code?: string;
  codeUrl?: string;
  linkUrl?: string;
  /** every raw code from a bulk mint, in order; single mints also set `code` */
  codes?: string[];
  warning?: string;
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

  let plan = String(formData.get("plan") || "full");
  if (!["full", "enterprise"].includes(plan)) return { error: "Invalid plan." };

  const grantDaysRaw = String(formData.get("grantDays") || "365").trim();
  const grantDays =
    grantDaysRaw === "" || grantDaysRaw === "0" ? null : parseInt(grantDaysRaw, 10);
  if (grantDays !== null && (!Number.isFinite(grantDays) || grantDays < 1 || grantDays > 3650))
    return { error: "Duration must be 1–3650 days (or blank for no expiry)." };

  // 1–500 matches the ceiling partner_mint_codes (0015) enforces, so the two
  // mint paths can't disagree about what a valid code looks like.
  const maxUses = Math.max(1, parseInt(String(formData.get("maxUses") || "1"), 10) || 1);
  if (maxUses > 500) return { error: "Uses per code must be between 1 and 500." };
  const note = String(formData.get("note") || "").trim().slice(0, 200) || null;
  const targetOrgId = String(formData.get("targetOrgId") || "").trim() || null;

  // Bulk mint. Absent field -> 1, so every existing caller is unchanged.
  const count = parseInt(String(formData.get("count") || "1"), 10) || 1;
  if (count < 1 || count > 200) return { error: "Mint between 1 and 200 codes at a time." };

  // Optional attribution to a partner. A partner code is never org-locked —
  // the whole point is that the partner doesn't know which workspace will use it.
  const partnerId = String(formData.get("partnerId") || "").trim() || null;
  if (partnerId && targetOrgId)
    return { error: "A partner code can't also be locked to one organization." };
  // Partner codes always grant 'full', matching partner_mint_codes (0015).
  // Enterprise is a custom bundled deal granted out of band, never via a partner.
  if (partnerId) plan = "full";

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

  const admin = createAdminClient();

  // Minting on a partner's behalf still spends their allowance — otherwise the
  // number in their console is a lie. This mirrors app.partner_seats_consumed
  // (0015) in TypeScript because the platform admin is NOT a partner member, so
  // partner_mint_codes() would (correctly) refuse them.
  //
  // Caveat, stated rather than hidden: this check is not serialized against a
  // partner minting at the same instant, unlike the RPC's `for update` lock. The
  // window is milliseconds on a path only you use; the worst case is a small
  // overshoot that shows as `overBy` in the console.
  if (partnerId) {
    const { data: p, error: pErr } = await admin
      .from("partners")
      .select("name, status, licence_allowance")
      .eq("id", partnerId)
      .single();
    if (pErr || !p) return { error: "Partner not found." };
    if (p.status !== "active") return { error: `${p.name} is suspended.` };

    const { data: existing } = await admin
      .from("access_codes")
      .select("max_uses, used_count, revoked_at, expires_at")
      .eq("partner_id", partnerId);
    const now = Date.now();
    const consumed = (existing ?? []).reduce((sum, c) => {
      const lapsed = c.expires_at && new Date(c.expires_at).getTime() < now;
      return sum + (c.revoked_at || lapsed ? c.used_count : c.max_uses);
    }, 0);
    const want = count * maxUses;
    if (consumed + want > p.licence_allowance)
      return {
        error: `Not enough licences: ${Math.max(p.licence_allowance - consumed, 0)} of ${p.licence_allowance} remaining, this mint needs ${want}.`,
      };
  }

  const raws = generateCodes(count);
  const batchId = count > 1 ? randomUUID() : null;
  const base = raws.map((raw) => ({
    code_hash: createHash("sha256").update(raw).digest("hex"),
    plan,
    grant_days: grantDays,
    max_uses: maxUses,
    expires_at: expiresAt,
    note,
    created_by: g.uid,
  }));
  // Prefer the full row (raw code for re-display, optional org lock, partner
  // attribution); fall back to hash-only if those columns aren't present yet
  // (migrations 0005 / 0006 / 0015).
  const full = base.map((row, i) => ({
    ...row,
    code: raws[i],
    ...(targetOrgId ? { target_org_id: targetOrgId } : {}),
    ...(partnerId ? { partner_id: partnerId, batch_id: batchId } : {}),
  }));
  let ins = await admin.from("access_codes").insert(full);
  if (ins.error) {
    // The hash-only fallback drops target_org_id AND partner_id — never silently
    // downgrade an org-locked code into a generic one, and never mint a code
    // against an allowance it won't be counted towards.
    if (targetOrgId || partnerId)
      return {
        error:
          "Could not create the code (ensure migrations 0005, 0006 & 0015 are applied): " +
          ins.error.message,
      };
    ins = await admin.from("access_codes").insert(base);
  }
  if (ins.error) return { error: ins.error.message };

  const origin = await requestOrigin();
  revalidatePath("/admin");
  return {
    // Raw codes are stored (0005), so a batch stays re-exportable from the list
    // below — no "copy it now" ceremony, which was never true after 0005 anyway.
    message:
      count === 1
        ? "Access code created."
        : `${count} access codes created (${count * maxUses} licences).`,
    code: raws[0],
    codeUrl: `${origin}/redeem/${raws[0]}`,
    codes: raws,
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

  const origin = await requestOrigin();
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

// Switch the agent/MCP entitlement on or off for one workspace. This is the
// separately-sold agentic offering, not part of the licence — so it lives here,
// with the plan controls, and NOT in workspace settings. The columns are
// ungranted to `authenticated` (0013), so this service-role path is the only
// way to change them.
//
// Effect is immediate and reversible: the API checks the entitlement on every
// request, so switching off makes existing keys inert without destroying them,
// and switching back on restores them with nothing to re-issue.
export async function setOrgAgentAccess(
  _prev: Res,
  formData: FormData,
): Promise<Res> {
  const g = await gate();
  if ("error" in g) return { error: g.error };

  const orgId = String(formData.get("orgId") || "");
  if (!orgId) return { error: "Missing organization." };
  const enabled = String(formData.get("enabled") || "") === "true";

  // Days only apply when switching ON; blank/0 = no expiry.
  const raw = String(formData.get("agenticDays") ?? "").trim();
  let expiresAt: string | null = null;
  if (enabled && raw !== "" && raw !== "0") {
    const days = parseInt(raw, 10);
    if (!Number.isFinite(days) || days < 1 || days > 3650)
      return { error: "Duration must be 1–3650 days (or blank for no expiry)." };
    expiresAt = new Date(Date.now() + days * 86400000).toISOString();
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("organizations")
    .update({
      agentic_enabled: enabled,
      agentic_expires_at: enabled ? expiresAt : null,
    })
    .eq("id", orgId);
  if (error) {
    if (/column .* does not exist/i.test(error.message))
      return { error: "Apply database migration 0013, then try again." };
    return { error: error.message };
  }

  await admin.from("audit_log").insert({
    org_id: orgId,
    actor_id: g.uid,
    action: enabled ? "agentic.enabled" : "agentic.disabled",
    entity_type: "organization",
    entity_id: orgId,
    detail: { agentic_expires_at: expiresAt },
  });
  revalidatePath("/admin");
  return {
    message: enabled
      ? `Agent access ON${expiresAt ? ` until ${expiresAt.slice(0, 10)}` : ""}.`
      : "Agent access OFF — existing keys are now inert.",
  };
}

// Agent budgets for one workspace. PLATFORM-admin only, deliberately: these
// columns are ungranted to `authenticated` (migration 0012) so a workspace can
// never raise its own ceiling — same reasoning as the plan columns in 0007.
// Blank = fall back to the app default.
export async function setOrgAgentLimits(
  _prev: Res,
  formData: FormData,
): Promise<Res> {
  const g = await gate();
  if ("error" in g) return { error: g.error };

  const orgId = String(formData.get("orgId") || "");
  if (!orgId) return { error: "Missing organization." };

  const num = (key: string, max: number): number | null | "bad" => {
    const raw = String(formData.get(key) ?? "").trim();
    if (raw === "") return null; // blank -> use the default
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 1 || n > max) return "bad";
    return n;
  };
  const rate = num("agentRateLimit", 10000);
  const write = num("agentWriteLimit", 100000);
  if (rate === "bad") return { error: "Requests/minute must be 1–10000 (or blank)." };
  if (write === "bad") return { error: "Writes/day must be 1–100000 (or blank)." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("organizations")
    .update({ agent_rate_limit: rate, agent_write_limit: write })
    .eq("id", orgId);
  if (error) {
    if (/column .* does not exist/i.test(error.message))
      return { error: "Apply database migration 0012, then try again." };
    return { error: error.message };
  }

  await admin.from("audit_log").insert({
    org_id: orgId,
    actor_id: g.uid,
    action: "agent_limits.set_by_platform_admin",
    entity_type: "organization",
    entity_id: orgId,
    detail: { agent_rate_limit: rate, agent_write_limit: write },
  });
  revalidatePath("/admin");
  return {
    message: `Agent budget: ${rate ?? "default"} req/min, ${write ?? "default"} writes/day.`,
  };
}

// SOFT revoke. This used to be a hard DELETE, which was a quiet data-loss bug:
// code_redemptions.code_id is ON DELETE CASCADE (0004), so deleting a redeemed
// code erased the record that a workspace was ever granted a plan — while the
// workspace kept the plan. Setting revoked_at disables the code (the redeem RPC
// refuses it since 0015) and, for partner codes, returns the unredeemed
// remainder to their allowance.
export async function revokeAccessCode(_prev: Res, formData: FormData): Promise<Res> {
  const g = await gate();
  if ("error" in g) return { error: g.error };
  const id = String(formData.get("codeId") || "");
  if (!id) return { error: "Missing code." };

  const admin = createAdminClient();
  const { data: code } = await admin
    .from("access_codes")
    .select("max_uses, used_count, expires_at, partner_id")
    .eq("id", id)
    .single();

  const { error } = await admin
    .from("access_codes")
    .update({ revoked_at: new Date().toISOString(), revoked_by: g.uid })
    .eq("id", id)
    .is("revoked_at", null);
  if (error) return { error: error.message };

  revalidatePath("/admin");
  // Only a code that was still live was holding seats — a lapsed redeem-by
  // window already released them (app.partner_seats_consumed), so revoking one
  // frees nothing and must not claim otherwise.
  const lapsed =
    !!code?.expires_at && new Date(code.expires_at).getTime() < Date.now();
  const freed =
    code && code.partner_id && !lapsed
      ? Math.max(code.max_uses - code.used_count, 0)
      : 0;
  return {
    message: freed
      ? `Code revoked — ${freed} licence${freed === 1 ? "" : "s"} returned.`
      : "Code revoked.",
  };
}

// ============================================================================
// Partners — accelerators, incubators and investors (migration 0015).
// The platform admin owns every field here. A partner admin can read their own
// row (RLS policy pt_select) but the table has no write grant at all, so the
// service role below is the only path.
// ============================================================================

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,30}$/;
// Must stay in step with the CHECK constraint in 0015 — a partner claiming one
// of these would shadow an infrastructure hostname once subdomains ship.
const RESERVED_SLUGS = new Set([
  "www", "app", "api", "admin", "auth", "mail", "static", "assets",
  "cdn", "docs", "status", "dev", "staging", "test", "support", "help",
]);

function readSlug(formData: FormData): string | { error: string } {
  const slug = String(formData.get("slug") || "").trim().toLowerCase();
  if (!SLUG_RE.test(slug))
    return {
      error: "Slug must be 2–31 characters: lowercase letters, numbers and hyphens.",
    };
  if (RESERVED_SLUGS.has(slug)) return { error: `"${slug}" is reserved.` };
  return slug;
}

export async function createPartner(_prev: Res, formData: FormData): Promise<Res> {
  const g = await gate();
  if ("error" in g) return { error: g.error };

  const name = String(formData.get("name") || "").trim();
  if (!name) return { error: "Name is required." };
  const slug = readSlug(formData);
  if (typeof slug !== "string") return slug;

  const kind = String(formData.get("kind") || "accelerator");
  if (!["accelerator", "incubator", "investor", "other"].includes(kind))
    return { error: "Invalid partner type." };

  const allowance = parseInt(String(formData.get("licenceAllowance") || "0"), 10);
  if (!Number.isFinite(allowance) || allowance < 0 || allowance > 100000)
    return { error: "Licence allowance must be between 0 and 100000." };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("partners")
    .insert({
      name,
      slug,
      kind,
      licence_allowance: allowance,
      contact_email: String(formData.get("contactEmail") || "").trim() || null,
      note: String(formData.get("note") || "").trim().slice(0, 200) || null,
      created_by: g.uid,
    })
    .select("id")
    .single();
  if (error)
    return {
      error:
        error.code === "23505"
          ? `The slug "${slug}" is already taken.`
          : error.message,
    };

  await admin.from("partner_audit").insert({
    partner_id: data.id,
    actor_id: g.uid,
    action: "partner.create",
    entity_type: "partner",
    entity_id: data.id,
    detail: { name, slug, kind, licence_allowance: allowance },
  });
  revalidatePath("/admin");
  return { message: `Created ${name} with ${allowance} licences.` };
}

// Raising and lowering both land here. Lowering BELOW what is already issued is
// allowed on purpose: those codes are commitments to real portfolio companies
// and must not be invalidated by moving a number. The partner simply can't mint
// again until usage drops back under the cap.
export async function setPartnerAllowance(_prev: Res, formData: FormData): Promise<Res> {
  const g = await gate();
  if ("error" in g) return { error: g.error };

  const partnerId = String(formData.get("partnerId") || "");
  if (!partnerId) return { error: "Missing partner." };
  const allowance = parseInt(String(formData.get("licenceAllowance") || ""), 10);
  if (!Number.isFinite(allowance) || allowance < 0 || allowance > 100000)
    return { error: "Licence allowance must be between 0 and 100000." };

  const admin = createAdminClient();
  const { data: p, error } = await admin
    .from("partners")
    .update({ licence_allowance: allowance, updated_at: new Date().toISOString() })
    .eq("id", partnerId)
    .select("name")
    .single();
  if (error) return { error: error.message };

  await admin.from("partner_audit").insert({
    partner_id: partnerId,
    actor_id: g.uid,
    action: "partner.allowance",
    entity_type: "partner",
    entity_id: partnerId,
    detail: { licence_allowance: allowance },
  });
  revalidatePath("/admin");

  const { data: codes } = await admin
    .from("access_codes")
    .select("max_uses, used_count, revoked_at, expires_at")
    .eq("partner_id", partnerId);
  const now = Date.now();
  const consumed = (codes ?? []).reduce((sum, c) => {
    const lapsed = c.expires_at && new Date(c.expires_at).getTime() < now;
    return sum + (c.revoked_at || lapsed ? c.used_count : c.max_uses);
  }, 0);

  return {
    message: `${p.name}: ${allowance} licences.`,
    warning:
      consumed > allowance
        ? `${consumed} licences are already issued — that's ${consumed - allowance} over. Existing codes stay valid; ${p.name} can't mint again until usage drops below ${allowance}.`
        : undefined,
  };
}

export async function updatePartner(_prev: Res, formData: FormData): Promise<Res> {
  const g = await gate();
  if ("error" in g) return { error: g.error };

  const partnerId = String(formData.get("partnerId") || "");
  if (!partnerId) return { error: "Missing partner." };

  const staffLimit = parseInt(String(formData.get("staffLimit") || ""), 10);
  if (!Number.isFinite(staffLimit) || staffLimit < 1 || staffLimit > 200)
    return { error: "Staff limit must be between 1 and 200." };

  // Blank = no bound. Each is validated the same way the mint RPC validates it.
  const optDays = (key: string, max: number): number | null | { error: string } => {
    const raw = String(formData.get(key) || "").trim();
    if (raw === "" || raw === "0") return null;
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 1 || n > max)
      return { error: `${key} must be between 1 and ${max} (or blank).` };
    return n;
  };
  const grant = optDays("defaultGrantDays", 3650);
  if (grant !== null && typeof grant === "object") return grant;
  const maxGrant = optDays("maxGrantDays", 3650);
  if (maxGrant !== null && typeof maxGrant === "object") return maxGrant;
  const redeem = optDays("defaultRedeemDays", 365);
  if (redeem !== null && typeof redeem === "object") return redeem;

  const admin = createAdminClient();
  const { error } = await admin
    .from("partners")
    .update({
      staff_limit: staffLimit,
      default_grant_days: grant,
      max_grant_days: maxGrant,
      default_redeem_days: redeem,
      updated_at: new Date().toISOString(),
    })
    .eq("id", partnerId);
  if (error) return { error: error.message };

  await admin.from("partner_audit").insert({
    partner_id: partnerId,
    actor_id: g.uid,
    action: "partner.update",
    entity_type: "partner",
    entity_id: partnerId,
    detail: {
      staff_limit: staffLimit,
      default_grant_days: grant,
      max_grant_days: maxGrant,
      default_redeem_days: redeem,
    },
  });
  revalidatePath("/admin");
  return { message: "Partner settings saved." };
}

// Suspension is the real off-switch — it blocks minting AND redemption of every
// outstanding code (both enforced in the DB, see 0015). Reversible.
export async function setPartnerStatus(_prev: Res, formData: FormData): Promise<Res> {
  const g = await gate();
  if ("error" in g) return { error: g.error };

  const partnerId = String(formData.get("partnerId") || "");
  const status = String(formData.get("status") || "");
  if (!partnerId) return { error: "Missing partner." };
  if (!["active", "suspended"].includes(status)) return { error: "Invalid status." };

  const admin = createAdminClient();
  const { data: p, error } = await admin
    .from("partners")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", partnerId)
    .select("name")
    .single();
  if (error) return { error: error.message };

  await admin.from("partner_audit").insert({
    partner_id: partnerId,
    actor_id: g.uid,
    action: status === "active" ? "partner.reactivate" : "partner.suspend",
    entity_type: "partner",
    entity_id: partnerId,
  });
  revalidatePath("/admin");
  return {
    message:
      status === "active"
        ? `${p.name} reactivated.`
        : `${p.name} suspended — their codes no longer redeem.`,
  };
}

const HEX = /^#[0-9a-fA-F]{6}$/;

// White-label palette + wordmark + logo. The colours land in a style attribute
// on every page a partner's tenants load, so the format is checked here, again
// by a DB check constraint (0015), and a third time in brandStyle() before
// render. Belt, braces, and a second pair of braces.
export async function setPartnerBranding(_prev: Res, formData: FormData): Promise<Res> {
  const g = await gate();
  if ("error" in g) return { error: g.error };

  const partnerId = String(formData.get("partnerId") || "");
  if (!partnerId) return { error: "Missing partner." };

  const colour = (key: string): string | null | { error: string } => {
    const raw = String(formData.get(key) || "").trim();
    if (raw === "") return null;
    if (!HEX.test(raw))
      return { error: `${key} must be a 6-digit hex colour like #0b2a26.` };
    return raw.toLowerCase();
  };

  const fields: Record<string, string | null> = {};
  for (const [form, col] of [
    ["brandPrimary", "brand_primary"],
    ["brandMid", "brand_mid"],
    ["brandAccent", "brand_accent"],
    ["brandSurface", "brand_surface"],
  ] as const) {
    const v = colour(form);
    if (v !== null && typeof v === "object") return v;
    fields[col] = v;
  }

  const wordmark = String(formData.get("wordmark") || "").trim().slice(0, 40);
  fields.wordmark = wordmark || null;
  const logoAlt = String(formData.get("logoAlt") || "").trim().slice(0, 120);
  fields.logo_alt = logoAlt || null;

  const admin = createAdminClient();

  // Optional logo. Content-hashed filename so a replacement busts every cache
  // without us having to think about it.
  const file = formData.get("logo");
  if (file instanceof File && file.size > 0) {
    if (file.size > 512 * 1024)
      return { error: "Logo must be under 512 KB." };
    const okTypes: Record<string, string> = {
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/webp": "webp",
      "image/svg+xml": "svg",
    };
    const ext = okTypes[file.type];
    if (!ext) return { error: "Logo must be a PNG, JPEG, WebP or SVG." };

    const bytes = Buffer.from(await file.arrayBuffer());
    const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 12);
    const path = `partner/${partnerId}/logo-${hash}.${ext}`;
    const { error: upErr } = await admin.storage
      .from("brand")
      .upload(path, bytes, { contentType: file.type, upsert: true });
    if (upErr) return { error: `Logo upload failed: ${upErr.message}` };
    fields.logo_path = path;
  }

  const { data: p, error } = await admin
    .from("partners")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", partnerId)
    .select("name")
    .single();
  if (error) return { error: error.message };

  await admin.from("partner_audit").insert({
    partner_id: partnerId,
    actor_id: g.uid,
    action: "partner.branding",
    entity_type: "partner",
    entity_id: partnerId,
    detail: fields,
  });
  revalidatePath("/admin");
  revalidatePath("/partner");
  return { message: `Branding saved for ${p.name}.` };
}

// Bootstrap: seats the FIRST admin at a partner. After that they invite their
// own colleagues from the partner console (lib/partners/actions.ts), which is
// gated on being a partner admin — so this is the only way in from cold.
// Service role because partner_invitations' ptinv_admin policy requires being a
// partner admin, which the platform admin deliberately never is.
export async function invitePartnerAdmin(_prev: Res, formData: FormData): Promise<Res> {
  const g = await gate();
  if ("error" in g) return { error: g.error };

  const partnerId = String(formData.get("partnerId") || "");
  const email = String(formData.get("email") || "").trim().toLowerCase();
  if (!partnerId) return { error: "Missing partner." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return { error: "Enter a valid email address." };
  const role = String(formData.get("role") || "admin");
  if (!["admin", "member"].includes(role)) return { error: "Invalid role." };

  // Same token contract as every other invite: share the raw value, store only
  // its SHA-256. accept_partner_invitation re-hashes to match.
  const raw = randomBytes(24).toString("base64url");
  const tokenHash = createHash("sha256").update(raw).digest("hex");

  const admin = createAdminClient();
  const { error } = await admin.from("partner_invitations").insert({
    partner_id: partnerId,
    email,
    role,
    token_hash: tokenHash,
    invited_by: g.uid,
  });
  if (error)
    return {
      error:
        (error as { code?: string }).code === "23505"
          ? "There's already a pending invite for that email."
          : error.message,
    };

  await admin.from("partner_audit").insert({
    partner_id: partnerId,
    actor_id: g.uid,
    action: "staff.invite",
    entity_type: "partner_invitation",
    entity_id: email,
    detail: { role, by: "platform_admin" },
  });

  const origin = await requestOrigin();
  revalidatePath("/admin");
  return {
    message: `Invite ready for ${email}.`,
    linkUrl: `${origin}/accept-partner-invite/${raw}`,
  };
}

export async function deletePartner(_prev: Res, formData: FormData): Promise<Res> {
  const g = await gate();
  if ("error" in g) return { error: g.error };

  const partnerId = String(formData.get("partnerId") || "");
  const confirmName = String(formData.get("confirmName") || "").trim();
  if (!partnerId) return { error: "Missing partner." };

  const admin = createAdminClient();
  const { data: p, error: fErr } = await admin
    .from("partners")
    .select("name")
    .eq("id", partnerId)
    .single();
  if (fErr || !p) return { error: "Partner not found." };
  if (confirmName !== p.name)
    return { error: "The typed name doesn't match — nothing deleted." };

  // access_codes.partner_id is ON DELETE RESTRICT, so this fails by design once
  // any code exists. That FK is the policy: codes in portfolio companies' hands
  // must never be orphaned out of allowance accounting.
  const { error } = await admin.from("partners").delete().eq("id", partnerId);
  if (error)
    return {
      error:
        error.code === "23503"
          ? `${p.name} has issued access codes and can't be deleted. Suspend them instead.`
          : error.message,
    };

  revalidatePath("/admin");
  return { message: `Deleted ${p.name}.` };
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
