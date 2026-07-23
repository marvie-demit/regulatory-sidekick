// SERVER ONLY — reads agent tokens for the settings page.
// (Kept out of lib/auth/agent-tokens.ts so the client bundle never pulls in the
// service-role client.)

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AgentScope, AgentToken, AgentTokenStatus } from "@/lib/auth/agent-tokens";

type Row = {
  id: string;
  name: string;
  token_prefix: string;
  scopes: string[];
  status: string;
  created_by: string;
  approved_by: string | null;
  approved_at: string | null;
  last_used_at: string | null;
  expires_at: string;
  created_at: string;
};

// Tokens for the workspace (RLS at_select scopes this to members; the hash is
// never selected). Creator / approver emails live in auth.users, so they're
// resolved with the service role — deduped, in parallel, and best-effort.
export async function getAgentTokens(orgId: string): Promise<AgentToken[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const me = user?.id ?? null;

  const { data, error } = await supabase
    .from("agent_tokens")
    .select(
      "id, name, token_prefix, scopes, status, created_by, approved_by, approved_at, last_used_at, expires_at, created_at",
    )
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  // Migration 0011 may not be applied yet — an empty list keeps the page up.
  if (error || !data) return [];
  const rows = data as Row[];

  const ids = [
    ...new Set(rows.flatMap((r) => [r.created_by, r.approved_by]).filter(Boolean)),
  ] as string[];
  const admin = createAdminClient();
  const emailById = new Map<string, string>();
  await Promise.all(
    ids.map(async (id) => {
      try {
        const { data: u } = await admin.auth.admin.getUserById(id);
        emailById.set(id, u.user?.email ?? "");
      } catch {
        emailById.set(id, "");
      }
    }),
  );

  const now = Date.now();
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    prefix: r.token_prefix,
    scopes: r.scopes as AgentScope[],
    status: r.status as AgentTokenStatus,
    createdByEmail: emailById.get(r.created_by) || "a teammate",
    createdByYou: r.created_by === me,
    approvedByEmail: r.approved_by ? emailById.get(r.approved_by) || "" : null,
    approvedAt: r.approved_at,
    lastUsedAt: r.last_used_at,
    expiresAt: r.expires_at,
    expired: new Date(r.expires_at).getTime() < now,
    createdAt: r.created_at,
  }));
}
