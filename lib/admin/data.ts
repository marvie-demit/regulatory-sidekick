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

export type AdminOrg = {
  id: string;
  name: string;
  plan: string;
  planExpiresAt: string | null;
  createdAt: string;
  members: number;
  ownerEmail: string | null;
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
    .select(
      "id, name, plan, plan_expires_at, created_at, created_by, memberships(count)",
    )
    .order("created_at", { ascending: false })
    .limit(100);
  const rows = (data ?? []) as Record<string, unknown>[];
  // Resolve owner emails in parallel — this was ~100 sequential round-trips.
  return Promise.all(
    rows.map(async (o) => {
      let ownerEmail: string | null = null;
      try {
        const { data: u } = await admin.auth.admin.getUserById(
          o.created_by as string,
        );
        ownerEmail = u.user?.email ?? null;
      } catch {
        // ignore identity lookup failure — still show the org row
      }
      return {
        id: o.id as string,
        name: o.name as string,
        plan: (o.plan as string) ?? "explore",
        planExpiresAt: (o.plan_expires_at as string | null) ?? null,
        createdAt: o.created_at as string,
        members: Array.isArray(o.memberships)
          ? ((o.memberships[0] as { count?: number })?.count ?? 0)
          : 0,
        ownerEmail,
      };
    }),
  );
}
