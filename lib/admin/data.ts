import { createAdminClient } from "@/lib/supabase/admin";

// Platform-admin reads (service role). Only ever called from the gated /admin page.

export type AccessCode = {
  id: string;
  plan: string;
  grantDays: number | null;
  maxUses: number;
  usedCount: number;
  expiresAt: string | null;
  note: string | null;
  createdAt: string;
};

export type AdminOrg = {
  id: string;
  name: string;
  plan: string;
  planExpiresAt: string | null;
  createdAt: string;
  members: number;
};

export async function listAccessCodes(): Promise<AccessCode[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("access_codes")
    .select("id, plan, grant_days, max_uses, used_count, expires_at, note, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? []).map((c) => ({
    id: c.id as string,
    plan: c.plan as string,
    grantDays: (c.grant_days as number | null) ?? null,
    maxUses: c.max_uses as number,
    usedCount: c.used_count as number,
    expiresAt: (c.expires_at as string | null) ?? null,
    note: (c.note as string | null) ?? null,
    createdAt: c.created_at as string,
  }));
}

export async function listOrgs(): Promise<AdminOrg[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("organizations")
    .select("id, name, plan, plan_expires_at, created_at, memberships(count)")
    .order("created_at", { ascending: false })
    .limit(100);
  return (data ?? []).map((o: Record<string, unknown>) => ({
    id: o.id as string,
    name: o.name as string,
    plan: (o.plan as string) ?? "explore",
    planExpiresAt: (o.plan_expires_at as string | null) ?? null,
    createdAt: o.created_at as string,
    members: Array.isArray(o.memberships)
      ? ((o.memberships[0] as { count?: number })?.count ?? 0)
      : 0,
  }));
}
