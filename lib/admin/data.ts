import { createAdminClient } from "@/lib/supabase/admin";

// Platform-admin reads (service role). Only ever called from the gated /admin page.

export type AccessCode = {
  id: string;
  code: string | null; // raw code (null for codes minted before 0005)
  plan: string;
  grantDays: number | null;
  maxUses: number;
  usedCount: number;
  expiresAt: string | null;
  note: string | null;
  targetOrgId: string | null; // set = locked to that org (0006)
  partnerId: string | null; // set = minted against a partner's allowance (0015)
  batchId: string | null; // groups codes minted together (0015)
  revokedAt: string | null; // soft revoke — the row survives so redemptions do
  createdAt: string;
};

export type OrgMember = { email: string | null; role: string };

export type AdminOrg = {
  id: string;
  name: string;
  plan: string;
  planExpiresAt: string | null;
  createdAt: string;
  members: number;
  ownerEmail: string | null;
  memberList: OrgMember[];
  /** agent budget overrides; null = the app default */
  agentRateLimit: number | null;
  agentWriteLimit: number | null;
  /** the separately-sold agent/MCP entitlement */
  agenticEnabled: boolean;
  agenticExpiresAt: string | null;
  /** agent connection health — cheap facts, not analytics */
  agentKeys: number; // live keys (not revoked)
  agentKeysPending: number; // waiting on a workspace admin — a silent blocker
  agentLastUsedAt: string | null; // null with the add-on ON = paying, never used
};

// One user_id -> email map for everyone, instead of a lookup per user. Paged
// (perPage 1000); caps at 10 pages (10k users) — plenty for now, and never a
// reason to fail the whole list. Shared by the org and partner listings.
export async function emailsByUserId(): Promise<Map<string, string>> {
  const admin = createAdminClient();
  const emailById = new Map<string, string>();
  try {
    for (let page = 1; page <= 10; page++) {
      const { data: pageData } = await admin.auth.admin.listUsers({
        page,
        perPage: 1000,
      });
      const users = pageData?.users ?? [];
      users.forEach((u) => {
        if (u.email) emailById.set(u.id, u.email);
      });
      if (users.length < 1000) break;
    }
  } catch {
    // identity lookup unavailable — rows still render, emails just show as unknown
  }
  return emailById;
}

export async function listAccessCodes(): Promise<AccessCode[]> {
  const admin = createAdminClient();
  const BASE =
    "id, plan, grant_days, max_uses, used_count, expires_at, note, created_at";
  const WITH_RAW = `${BASE}, code, target_org_id`;
  // Resilient to migrations 0005/0006/0015 not being applied yet — step down
  // through narrower selects so the list still renders.
  const pick = (cols: string) =>
    admin
      .from("access_codes")
      .select(cols)
      .order("created_at", { ascending: false })
      .limit(200);

  let res: { data: unknown[] | null; error: unknown } = await pick(
    `${WITH_RAW}, partner_id, batch_id, revoked_at`,
  );
  if (res.error) res = await pick(WITH_RAW);
  if (res.error) res = await pick(BASE);
  const rows = (res.data ?? []) as Record<string, unknown>[];
  return rows.map((c) => ({
    id: c.id as string,
    code: (c.code as string | null) ?? null,
    plan: c.plan as string,
    grantDays: (c.grant_days as number | null) ?? null,
    maxUses: c.max_uses as number,
    usedCount: c.used_count as number,
    expiresAt: (c.expires_at as string | null) ?? null,
    note: (c.note as string | null) ?? null,
    targetOrgId: (c.target_org_id as string | null) ?? null,
    partnerId: (c.partner_id as string | null) ?? null,
    batchId: (c.batch_id as string | null) ?? null,
    revokedAt: (c.revoked_at as string | null) ?? null,
    createdAt: c.created_at as string,
  }));
}

export async function listOrgs(): Promise<AdminOrg[]> {
  const admin = createAdminClient();
  const BASE = "id, name, plan, plan_expires_at, created_at, created_by";
  // Resilient to migration 0012 not being applied yet. (Loosely typed so the
  // narrower fallback select is assignable — same pattern as lib/auth/org.ts.)
  let orgRes: { data: unknown[] | null; error: unknown } = await admin
    .from("organizations")
    .select(
      `${BASE}, agent_rate_limit, agent_write_limit, agentic_enabled, agentic_expires_at`,
    )
    .order("created_at", { ascending: false })
    .limit(100);
  if (orgRes.error)
    orgRes = await admin
      .from("organizations")
      .select(BASE)
      .order("created_at", { ascending: false })
      .limit(100);
  const rows = (orgRes.data ?? []) as Record<string, unknown>[];
  const orgIds = rows.map((o) => o.id as string);

  // All memberships for the listed orgs, in one query (service role bypasses RLS).
  const { data: mems } = await admin
    .from("memberships")
    .select("org_id, user_id, role")
    .in("org_id", orgIds.length ? orgIds : ["00000000-0000-0000-0000-000000000000"]);
  const memRows = (mems ?? []) as {
    org_id: string;
    user_id: string;
    role: string;
  }[];

  // Agent connection health, same shape as the memberships read above: ONE query
  // for every listed org, folded into a Map — not an N+1. Wrapped because
  // migration 0011 may not be applied; a missing table must read as "no keys",
  // never blank the org list.
  let tokRows: {
    org_id: string;
    status: string;
    last_used_at: string | null;
  }[] = [];
  {
    const { data, error } = await admin
      .from("agent_tokens")
      .select("org_id, status, last_used_at")
      .in(
        "org_id",
        orgIds.length ? orgIds : ["00000000-0000-0000-0000-000000000000"],
      );
    if (!error) tokRows = (data ?? []) as typeof tokRows;
  }
  const agentByOrg = new Map<
    string,
    { live: number; pending: number; lastUsed: string | null }
  >();
  tokRows.forEach((t) => {
    const a = agentByOrg.get(t.org_id) ?? {
      live: 0,
      pending: 0,
      lastUsed: null,
    };
    if (t.status !== "revoked") a.live++;
    if (t.status === "pending") a.pending++;
    // ISO-8601 compares lexicographically — no Date allocation per row.
    if (t.last_used_at && (!a.lastUsed || t.last_used_at > a.lastUsed))
      a.lastUsed = t.last_used_at;
    agentByOrg.set(t.org_id, a);
  });

  const emailById = await emailsByUserId();

  const rank = (r: string) => (r === "admin" ? 0 : r === "member" ? 1 : 2);
  const byOrg = new Map<string, OrgMember[]>();
  memRows.forEach((m) => {
    const list = byOrg.get(m.org_id) ?? [];
    list.push({ email: emailById.get(m.user_id) ?? null, role: m.role });
    byOrg.set(m.org_id, list);
  });

  return rows.map((o) => {
    const id = o.id as string;
    const memberList = (byOrg.get(id) ?? []).sort(
      (a, b) => rank(a.role) - rank(b.role),
    );
    const ag = agentByOrg.get(id);
    return {
      id,
      name: o.name as string,
      plan: (o.plan as string) ?? "explore",
      planExpiresAt: (o.plan_expires_at as string | null) ?? null,
      createdAt: o.created_at as string,
      members: memberList.length,
      ownerEmail: emailById.get(o.created_by as string) ?? null,
      memberList,
      agentRateLimit: (o.agent_rate_limit as number | null) ?? null,
      agentWriteLimit: (o.agent_write_limit as number | null) ?? null,
      agenticEnabled: (o.agentic_enabled as boolean | null) ?? false,
      agenticExpiresAt: (o.agentic_expires_at as string | null) ?? null,
      agentKeys: ag?.live ?? 0,
      agentKeysPending: ag?.pending ?? 0,
      agentLastUsedAt: ag?.lastUsed ?? null,
    };
  });
}
