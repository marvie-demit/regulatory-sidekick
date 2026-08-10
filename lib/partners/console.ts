import { createClient } from "@/lib/supabase/server";

// Partner-facing reads. Every one of these uses the USER's client, so RLS and
// the SECURITY DEFINER projections in 0015 are the boundary — the service role
// never appears on a partner code path. That is the whole reason a partner
// cannot see anything about a portfolio company beyond a name and a date.

export type PartnerOverview = {
  allowance: number;
  consumed: number;
  remaining: number;
  status: string;
  staffLimit: number;
  redemptions: number;
};

export type PartnerCode = {
  id: string;
  code: string | null;
  note: string | null;
  maxUses: number;
  usedCount: number;
  grantDays: number | null;
  expiresAt: string | null;
  revokedAt: string | null;
  batchId: string | null;
  createdAt: string;
};

export type PortfolioRow = {
  workspaceName: string;
  redeemedAt: string;
  codeNote: string | null;
};

export async function getPartnerOverview(
  partnerId: string,
): Promise<PartnerOverview> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("partner_overview", { p_partner: partnerId });
  const o = (data ?? {}) as Record<string, unknown>;
  return {
    allowance: (o.allowance as number) ?? 0,
    consumed: (o.consumed as number) ?? 0,
    remaining: (o.remaining as number) ?? 0,
    status: (o.status as string) ?? "active",
    staffLimit: (o.staff_limit as number) ?? 10,
    redemptions: (o.redemptions as number) ?? 0,
  };
}

export async function listPartnerCodes(partnerId: string): Promise<PartnerCode[]> {
  const supabase = await createClient();
  // ac_partner_select (0015) already restricts this to the caller's partner;
  // the explicit .eq is belt and braces, not the boundary.
  const { data } = await supabase
    .from("access_codes")
    .select(
      "id, code, note, max_uses, used_count, grant_days, expires_at, revoked_at, batch_id, created_at",
    )
    .eq("partner_id", partnerId)
    .order("created_at", { ascending: false })
    .limit(500);

  return ((data ?? []) as Record<string, unknown>[]).map((c) => ({
    id: c.id as string,
    code: (c.code as string | null) ?? null,
    note: (c.note as string | null) ?? null,
    maxUses: c.max_uses as number,
    usedCount: c.used_count as number,
    grantDays: (c.grant_days as number | null) ?? null,
    expiresAt: (c.expires_at as string | null) ?? null,
    revokedAt: (c.revoked_at as string | null) ?? null,
    batchId: (c.batch_id as string | null) ?? null,
    createdAt: c.created_at as string,
  }));
}

export async function getPartnerPortfolio(
  partnerId: string,
): Promise<PortfolioRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("partner_portfolio", { p_partner: partnerId });
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    workspaceName: r.workspace_name as string,
    redeemedAt: r.redeemed_at as string,
    codeNote: (r.code_note as string | null) ?? null,
  }));
}
