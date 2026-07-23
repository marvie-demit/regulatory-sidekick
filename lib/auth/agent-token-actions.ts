"use server";

import { revalidatePath } from "next/cache";
import { randomBytes, createHash } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveOrg, type OrgMembership } from "@/lib/auth/org";
import { hasFullAccess } from "@/lib/auth/access";
import {
  AGENT_TOKEN_LIMIT,
  AGENT_TOKEN_TTL_DAYS,
  type AgentScope,
} from "@/lib/auth/agent-tokens";

type Res = { error?: string; message?: string; token?: string; name?: string };

const ALL_SCOPES: AgentScope[] = ["read", "write:status"];

// Machine access is a full-access capability, same as inviting teammates.
async function requireFull(): Promise<{ error: string } | { org: OrgMembership }> {
  const org = await getActiveOrg();
  if (!org) return { error: "No active organization." };
  if (!hasFullAccess(org.plan))
    return { error: "Agent access is part of full access." };
  return { org };
}

async function auditToken(
  orgId: string,
  actorId: string | null,
  action: string,
  tokenId: string,
  detail?: Record<string, unknown>,
) {
  try {
    await createAdminClient().from("audit_log").insert({
      org_id: orgId,
      actor_id: actorId,
      action,
      entity_type: "agent_token",
      entity_id: tokenId,
      detail: detail ?? null,
    });
  } catch {}
}

// Mint a token for the ACTIVE workspace. The raw value is returned once and
// never stored — only its SHA-256 goes to the database (same pattern as team
// invites). The row lands 'pending': it is inert until an admin approves it.
export async function createAgentToken(
  _prev: Res,
  formData: FormData,
): Promise<Res> {
  const gate = await requireFull();
  if ("error" in gate) return { error: gate.error };
  const org = gate.org;

  // Viewers are read-only members; RLS blocks the insert too (at_insert uses
  // app.can_write), this is the friendly message.
  if (org.role === "viewer")
    return { error: "Viewers can't create agent access." };

  const name = String(formData.get("name") || "").trim();
  if (name.length < 2 || name.length > 60)
    return { error: "Give the agent a name (2–60 characters)." };

  const wantsWrite = formData.get("write") === "on";
  const scopes: AgentScope[] = wantsWrite ? ["read", "write:status"] : ["read"];
  if (!scopes.every((s) => ALL_SCOPES.includes(s)))
    return { error: "Unknown permission requested." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Cap live keys per workspace (revoked ones don't count).
  const { count } = await supabase
    .from("agent_tokens")
    .select("*", { count: "exact", head: true })
    .eq("org_id", org.id)
    .in("status", ["pending", "active"]);
  if ((count ?? 0) >= AGENT_TOKEN_LIMIT)
    return {
      error: `A workspace can have ${AGENT_TOKEN_LIMIT} agent keys. Revoke one to add another.`,
    };

  const raw = `rsk_${randomBytes(24).toString("base64url")}`;
  const tokenHash = createHash("sha256").update(raw).digest("hex");
  const expiresAt = new Date(
    Date.now() + AGENT_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data, error } = await supabase
    .from("agent_tokens")
    .insert({
      org_id: org.id,
      name,
      token_hash: tokenHash,
      token_prefix: raw.slice(0, 12),
      scopes,
      status: "pending",
      created_by: user?.id,
      expires_at: expiresAt,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  await auditToken(org.id, user?.id ?? null, "agent_token.create", data.id, {
    name,
    scopes,
  });
  revalidatePath("/settings/organization");
  revalidatePath("/settings/members");
  return {
    message:
      org.role === "admin"
        ? "Key created. Approve it below to activate it."
        : "Key created. An admin has to approve it before it works.",
    token: raw,
    name,
  };
}

// Approve (activate) a pending key — admins only. RLS at_update enforces this
// server-side; the column grants mean an admin can only move status/approved_*.
export async function approveAgentToken(
  _prev: Res,
  formData: FormData,
): Promise<Res> {
  const gate = await requireFull();
  if ("error" in gate) return { error: gate.error };
  const org = gate.org;
  if (org.role !== "admin")
    return { error: "Only admins can approve agent access." };

  const id = String(formData.get("tokenId") || "");
  if (!id) return { error: "Missing key." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("agent_tokens")
    .update({
      status: "active",
      approved_by: user?.id,
      approved_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("org_id", org.id)
    .eq("status", "pending")
    .select("id, name")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "That key is no longer pending." };

  await auditToken(org.id, user?.id ?? null, "agent_token.approve", id, {
    name: data.name,
  });
  revalidatePath("/settings/organization");
  revalidatePath("/settings/members");
  return { message: `${data.name} is now active.` };
}

// Revoke — immediate and permanent (the key can never be re-activated; mint a
// new one instead). Admins can revoke any key; anyone can revoke their own.
export async function revokeAgentToken(
  _prev: Res,
  formData: FormData,
): Promise<Res> {
  const org = await getActiveOrg();
  if (!org) return { error: "No active organization." };
  const id = String(formData.get("tokenId") || "");
  if (!id) return { error: "Missing key." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: row } = await supabase
    .from("agent_tokens")
    .select("id, name, created_by, status")
    .eq("id", id)
    .eq("org_id", org.id)
    .maybeSingle();
  if (!row) return { error: "Key not found." };
  const isMine = row.created_by === user?.id;
  if (org.role !== "admin" && !isMine)
    return { error: "Only an admin can revoke someone else's key." };

  // Admins revoke in place (auditable tombstone). A member withdrawing their
  // own request deletes it — RLS at_update is admin-only, so an UPDATE would
  // silently no-op for them.
  if (org.role === "admin") {
    const { error } = await supabase
      .from("agent_tokens")
      .update({ status: "revoked" })
      .eq("id", id)
      .eq("org_id", org.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("agent_tokens")
      .delete()
      .eq("id", id)
      .eq("org_id", org.id);
    if (error) return { error: error.message };
  }

  await auditToken(org.id, user?.id ?? null, "agent_token.revoke", id, {
    name: row.name,
  });
  revalidatePath("/settings/organization");
  revalidatePath("/settings/members");
  return { message: `${row.name} revoked.` };
}
