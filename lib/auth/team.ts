"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { randomBytes, createHash } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveOrg, type OrgMembership } from "@/lib/auth/org";
import { hasFullAccess } from "@/lib/auth/access";
import { SEAT_LIMIT } from "@/lib/auth/members";

type Res = {
  error?: string;
  message?: string;
  inviteUrl?: string;
  email?: string;
};

const ROLES = ["admin", "member", "viewer"] as const;

// Only an admin of the active org, and only on a full-access plan, may invite.
async function requireAdminFull(): Promise<
  { error: string } | { org: OrgMembership }
> {
  const org = await getActiveOrg();
  if (!org) return { error: "No active organization." };
  if (org.role !== "admin")
    return { error: "Only admins can manage the team." };
  if (!hasFullAccess(org.plan))
    return { error: "Inviting teammates is part of full access." };
  return { org };
}

export async function createInvite(_prev: Res, formData: FormData): Promise<Res> {
  const gate = await requireAdminFull();
  if ("error" in gate) return { error: gate.error };
  const org = gate.org;

  const email = String(formData.get("email") || "").trim().toLowerCase();
  const role = String(formData.get("role") || "member");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return { error: "Enter a valid email address." };
  if (!ROLES.includes(role as (typeof ROLES)[number]))
    return { error: "Pick a valid role." };

  const supabase = await createClient();

  // Seat cap: active members + pending invites must stay under the limit.
  const [{ count: memCount }, { count: invCount }] = await Promise.all([
    supabase
      .from("memberships")
      .select("*", { count: "exact", head: true })
      .eq("org_id", org.id),
    supabase
      .from("invitations")
      .select("*", { count: "exact", head: true })
      .eq("org_id", org.id)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString()),
  ]);
  if ((memCount ?? 0) + (invCount ?? 0) >= SEAT_LIMIT)
    return {
      error: `Your plan includes ${SEAT_LIMIT} seats. Remove a member or revoke an invite to add someone.`,
    };

  // Random token; store only its SHA-256 (the RPC re-hashes the raw token to match).
  const raw = randomBytes(24).toString("base64url");
  const tokenHash = createHash("sha256").update(raw).digest("hex");
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("invitations").insert({
    org_id: org.id,
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

  // Service role: direct member INSERT to audit_log is revoked (migration 0008).
  await createAdminClient().from("audit_log").insert({
    org_id: org.id,
    actor_id: user?.id ?? null,
    action: "invitation.create",
    entity_type: "invitation",
    entity_id: email,
  });

  const hdrs = await headers();
  const origin =
    hdrs.get("origin") ?? `http://${hdrs.get("host") ?? "localhost:3100"}`;
  revalidatePath("/settings/members");
  return {
    message: `Invite ready for ${email}.`,
    email,
    inviteUrl: `${origin}/accept-invite/${raw}`,
  };
}

export async function revokeInvite(_prev: Res, formData: FormData): Promise<Res> {
  const gate = await requireAdminFull();
  if ("error" in gate) return { error: gate.error };
  const id = String(formData.get("inviteId") || "");
  if (!id) return { error: "Missing invite." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("invitations")
    .delete()
    .eq("id", id)
    .eq("org_id", gate.org.id);
  if (error) return { error: error.message };
  revalidatePath("/settings/members");
  return { message: "Invite revoked." };
}

export async function removeMember(_prev: Res, formData: FormData): Promise<Res> {
  const gate = await requireAdminFull();
  if ("error" in gate) return { error: gate.error };
  const org = gate.org;
  const userId = String(formData.get("userId") || "");
  if (!userId) return { error: "Missing member." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (userId === user?.id) return { error: "You can't remove yourself." };

  const { data: mems } = await supabase
    .from("memberships")
    .select("user_id, role")
    .eq("org_id", org.id);
  const target = (mems ?? []).find((m) => m.user_id === userId);
  if (!target) return { error: "Not a member of this organization." };
  if (
    target.role === "admin" &&
    (mems ?? []).filter((m) => m.role === "admin").length <= 1
  )
    return { error: "You can't remove the last admin." };

  const { error } = await supabase
    .from("memberships")
    .delete()
    .eq("org_id", org.id)
    .eq("user_id", userId);
  if (error) return { error: error.message };
  revalidatePath("/settings/members");
  return { message: "Member removed." };
}
