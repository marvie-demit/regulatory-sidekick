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
};

export async function listAccessCodes(): Promise<AccessCode[]> {
  const admin = createAdminClient();
  const cols =
    "id, code, plan, grant_days, max_uses, used_count, expires_at, note, target_org_id, created_at";
  let res: { data: unknown[] | null; error: unknown } = await admin
    .from("access_codes")
    .select(cols)
    .order("created_at", { ascending: false })
    .limit(50);
  // Resilient to migrations 0005/0006 not being applied yet — retry without the
  // newer columns so the list still renders.
  if (res.error) {
    res = await admin
      .from("access_codes")
      .select("id, plan, grant_days, max_uses, used_count, expires_at, note, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
  }
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
    createdAt: c.created_at as string,
  }));
}

export async function listOrgs(): Promise<AdminOrg[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("organizations")
    .select("id, name, plan, plan_expires_at, created_at, created_by")
    .order("created_at", { ascending: false })
    .limit(100);
  const rows = (data ?? []) as Record<string, unknown>[];
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

  // One user_id -> email map for everyone, instead of a lookup per user. Paged
  // (perPage 1000); caps at 10 pages (10k users) — plenty for now, and never a
  // reason to fail the whole list.
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
    return {
      id,
      name: o.name as string,
      plan: (o.plan as string) ?? "explore",
      planExpiresAt: (o.plan_expires_at as string | null) ?? null,
      createdAt: o.created_at as string,
      members: memberList.length,
      ownerEmail: emailById.get(o.created_by as string) ?? null,
      memberList,
    };
  });
}
