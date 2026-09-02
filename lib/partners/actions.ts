"use server";

import { requestOrigin } from "@/lib/http/origin";
import { revalidatePath } from "next/cache";
import { randomBytes, createHash } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePartnerAdmin } from "@/lib/partners/context";
import { generateCodes } from "@/lib/partners/codes";

// Partner-facing server actions. Every one re-gates with requirePartnerAdmin()
// rather than trusting the route it was reached from: Server Functions are POSTs
// to whatever route uses them, so a proxy matcher change can silently drop
// coverage (Next's own proxy docs say to authorize inside each function).
//
// The privileged operations go through the SECURITY DEFINER RPCs from 0015/0016,
// which re-check app.has_partner_role themselves. No partner path ever holds the
// service-role key except to resolve an email address from auth.users.

export type PartnerRes = {
  error?: string;
  message?: string;
  codes?: string[];
  inviteUrl?: string;
  email?: string;
};

const ROLES = ["admin", "member"] as const;

function optInt(
  formData: FormData,
  key: string,
  max: number,
): number | null | { error: string } {
  const raw = String(formData.get(key) || "").trim();
  if (raw === "" || raw === "0") return null;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1 || n > max)
    return { error: `Enter a value between 1 and ${max}, or leave it blank.` };
  return n;
}

export async function mintPartnerCodes(
  _prev: PartnerRes,
  formData: FormData,
): Promise<PartnerRes> {
  const gate = await requirePartnerAdmin();
  if ("error" in gate) return { error: gate.error };
  const partner = gate.partner;

  const count = parseInt(String(formData.get("count") || "1"), 10);
  if (!Number.isFinite(count) || count < 1 || count > 200)
    return { error: "Mint between 1 and 200 codes at a time." };
  const maxUses = parseInt(String(formData.get("maxUses") || "1"), 10);
  if (!Number.isFinite(maxUses) || maxUses < 1 || maxUses > 500)
    return { error: "Uses per code must be between 1 and 500." };

  const grantDays = optInt(formData, "grantDays", 3650);
  if (grantDays !== null && typeof grantDays === "object") return grantDays;
  const redeemDays = optInt(formData, "redeemDays", 365);
  if (redeemDays !== null && typeof redeemDays === "object") return redeemDays;

  const note = String(formData.get("note") || "").trim().slice(0, 200) || null;

  // A code may grant a licence, agent access, or both (0023). The two
  // allowances are separate, so an agent-only code costs no licence seats and a
  // licence-only code costs no agent seats — both checks run inside the RPC's
  // row lock, not here.
  const withPlan = String(formData.get("plan") || "on") === "on";
  const agentic = String(formData.get("agentic") || "") === "on";
  if (!withPlan && !agentic)
    return { error: "A code must grant a licence, agent access, or both." };

  const agenticDays = optInt(formData, "agenticDays", 3650);
  if (agenticDays !== null && typeof agenticDays === "object") return agenticDays;

  const raws = generateCodes(count);
  const supabase = await createClient();
  // The allowance check lives inside this RPC, under a row lock on the partner —
  // so two admins minting at the same instant cannot both spend the last seat.
  const { error } = await supabase.rpc("partner_mint_codes", {
    p_partner: partner.id,
    p_codes: raws,
    p_max_uses: maxUses,
    p_grant_days: grantDays,
    p_redeem_days: redeemDays,
    p_note: note,
    p_plan: withPlan,
    p_agentic: agentic,
    p_agentic_days: agenticDays,
  });
  if (error) return { error: error.message };

  revalidatePath("/partner");
  // Name what the seats were actually spent on — "3 codes created (3 licences)"
  // on an agent-only mint would be wrong twice over.
  const seats = count * maxUses;
  const what = [withPlan ? "licences" : null, agentic ? "agent seats" : null]
    .filter(Boolean)
    .join(" + ");
  return {
    message:
      count === 1 ? "Code created." : `${count} codes created (${seats} ${what}).`,
    codes: raws,
  };
}

export async function revokePartnerCode(
  _prev: PartnerRes,
  formData: FormData,
): Promise<PartnerRes> {
  const gate = await requirePartnerAdmin();
  if ("error" in gate) return { error: gate.error };

  const codeId = String(formData.get("codeId") || "");
  if (!codeId) return { error: "Missing code." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("partner_revoke_code", {
    p_code: codeId,
  });
  if (error) return { error: error.message };

  revalidatePath("/partner");
  const freed = ((data ?? {}) as { freed?: number }).freed ?? 0;
  return {
    message: freed
      ? `Code revoked. ${freed} licence${freed === 1 ? "" : "s"} returned.`
      : "Code revoked.",
  };
}

export async function invitePartnerStaff(
  _prev: PartnerRes,
  formData: FormData,
): Promise<PartnerRes> {
  const gate = await requirePartnerAdmin();
  if ("error" in gate) return { error: gate.error };
  const partner = gate.partner;

  const email = String(formData.get("email") || "").trim().toLowerCase();
  const role = String(formData.get("role") || "member");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return { error: "Enter a valid email address." };
  if (!ROLES.includes(role as (typeof ROLES)[number]))
    return { error: "Pick a valid role." };

  const supabase = await createClient();

  // Staff cap: members + pending invites. accept_partner_invitation re-checks it
  // at acceptance too (0015), so a stale invite can't push a partner over later.
  const [{ count: memCount }, { count: invCount }] = await Promise.all([
    supabase
      .from("partner_members")
      .select("*", { count: "exact", head: true })
      .eq("partner_id", partner.id),
    supabase
      .from("partner_invitations")
      .select("*", { count: "exact", head: true })
      .eq("partner_id", partner.id)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString()),
  ]);
  if ((memCount ?? 0) + (invCount ?? 0) >= partner.staffLimit)
    return {
      error: `${partner.name} has ${partner.staffLimit} staff seats. Remove someone or revoke an invite first.`,
    };

  // Random token; only its SHA-256 is stored (accept_partner_invitation re-hashes
  // the raw token to match). Same contract as org invites.
  const raw = randomBytes(24).toString("base64url");
  const tokenHash = createHash("sha256").update(raw).digest("hex");
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("partner_invitations").insert({
    partner_id: partner.id,
    email,
    role,
    token_hash: tokenHash,
    invited_by: user?.id ?? null,
  });
  if (error) {
    if ((error as { code?: string }).code === "23505")
      return { error: "There's already a pending invite for that email." };
    return { error: error.message };
  }

  // Service role: partner_audit INSERT is revoked from authenticated (0015).
  await createAdminClient().from("partner_audit").insert({
    partner_id: partner.id,
    actor_id: user?.id ?? null,
    action: "staff.invite",
    entity_type: "partner_invitation",
    entity_id: email,
  });

  revalidatePath("/partner/team");
  return {
    message: `Invite ready for ${email}.`,
    email,
    inviteUrl: `${await requestOrigin()}/accept-partner-invite/${raw}`,
  };
}

export async function revokePartnerInvite(
  _prev: PartnerRes,
  formData: FormData,
): Promise<PartnerRes> {
  const gate = await requirePartnerAdmin();
  if ("error" in gate) return { error: gate.error };
  const id = String(formData.get("inviteId") || "");
  if (!id) return { error: "Missing invite." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("partner_invitations")
    .delete()
    .eq("id", id)
    .eq("partner_id", gate.partner.id);
  if (error) return { error: error.message };
  revalidatePath("/partner/team");
  return { message: "Invite revoked." };
}

export async function removePartnerStaff(
  _prev: PartnerRes,
  formData: FormData,
): Promise<PartnerRes> {
  const gate = await requirePartnerAdmin();
  if ("error" in gate) return { error: gate.error };
  const userId = String(formData.get("userId") || "");
  if (!userId) return { error: "Missing person." };

  const supabase = await createClient();
  // partner_members has no write grant — the RPC (0016) is the only path, and it
  // enforces "not yourself" and "not the last admin" itself.
  const { error } = await supabase.rpc("remove_partner_member", {
    p_partner: gate.partner.id,
    p_user: userId,
  });
  if (error) return { error: error.message };
  revalidatePath("/partner/team");
  return { message: "Removed." };
}

export async function setPartnerStaffRole(
  _prev: PartnerRes,
  formData: FormData,
): Promise<PartnerRes> {
  const gate = await requirePartnerAdmin();
  if ("error" in gate) return { error: gate.error };
  const userId = String(formData.get("userId") || "");
  const role = String(formData.get("role") || "");
  if (!userId) return { error: "Missing person." };
  if (!ROLES.includes(role as (typeof ROLES)[number]))
    return { error: "Pick a valid role." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_partner_member_role", {
    p_partner: gate.partner.id,
    p_user: userId,
    p_role: role,
  });
  if (error) return { error: error.message };
  revalidatePath("/partner/team");
  return { message: `Role set to ${role}.` };
}
