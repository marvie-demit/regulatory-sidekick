import { createClient } from "@/lib/supabase/server";

// Partner-facing reads. Every one of these uses the USER's client, so RLS and
// the SECURITY DEFINER projections in 0015 are the boundary — the service role
// never appears on a partner code path. That is the whole reason a partner
// cannot see anything about a portfolio company beyond a name and a date.

export type PartnerOverview = {
  allowance: number;
  consumed: number;
  /** Agent seats are a SEPARATE allowance (0023), never licence seats. */
  agenticAllowance: number;
  agenticConsumed: number;
  agenticRemaining: number;
  remaining: number;
  status: string;
  staffLimit: number;
  redemptions: number;
};

export type PartnerCode = {
  id: string;
  code: string | null;
  /** null = agent-only code (0023) */
  plan: string | null;
  agentic: boolean;
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
    agenticAllowance: (o.agentic_allowance as number) ?? 0,
    agenticConsumed: (o.agentic_consumed as number) ?? 0,
    agenticRemaining: (o.agentic_remaining as number) ?? 0,
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
      "id, code, plan, agentic, note, max_uses, used_count, grant_days, expires_at, revoked_at, batch_id, created_at",
    )
    .eq("partner_id", partnerId)
    .order("created_at", { ascending: false })
    .limit(500);

  return ((data ?? []) as Record<string, unknown>[]).map((c) => ({
    id: c.id as string,
    code: (c.code as string | null) ?? null,
    plan: (c.plan as string | null) ?? null,
    agentic: Boolean(c.agentic),
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

/**
 * Startup Programme applications submitted through this partner.
 *
 * Goes through partner_startup_applications() (0021), NOT a table read. That
 * function is a deliberate widening of the 0015 privacy boundary — a partner
 * sees an applicant's funding position and revenue here, where partner_portfolio
 * gives them only a name and a date. It is scoped inside the database to this
 * partner's own applications and to submitted-or-later ones, so a draft someone
 * is still writing is never visible.
 */
export type PartnerApplication = {
  id: string;
  workspaceName: string;
  status: string;
  submittedAt: string | null;
  legalName: string | null;
  website: string | null;
  country: string | null;
  foundedOn: string | null;
  employees: number | null;
  deviceSummary: string | null;
  regulation: string | null;
  riskClass: string | null;
  fundingDilutive: number | null;
  fundingNonDilutive: number | null;
  revenue12m: number | null;
  whyBlocked: string | null;
  declared: boolean;
  decisionNote: string | null;
  reviewedAt: string | null;
};

export async function getPartnerApplications(
  partnerId: string,
): Promise<PartnerApplication[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("partner_startup_applications", {
    p_partner: partnerId,
  });
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    workspaceName: (r.workspace_name as string) ?? "—",
    status: r.status as string,
    submittedAt: (r.submitted_at as string | null) ?? null,
    legalName: (r.legal_name as string | null) ?? null,
    website: (r.website as string | null) ?? null,
    country: (r.country as string | null) ?? null,
    foundedOn: (r.founded_on as string | null) ?? null,
    employees: (r.employees as number | null) ?? null,
    deviceSummary: (r.device_summary as string | null) ?? null,
    regulation: (r.regulation as string | null) ?? null,
    riskClass: (r.risk_class as string | null) ?? null,
    fundingDilutive: (r.funding_dilutive_eur as number | null) ?? null,
    fundingNonDilutive: (r.funding_non_dilutive_eur as number | null) ?? null,
    revenue12m: (r.revenue_12m_eur as number | null) ?? null,
    whyBlocked: (r.why_blocked as string | null) ?? null,
    declared: Boolean(r.declared),
    decisionNote: (r.decision_note as string | null) ?? null,
    reviewedAt: (r.reviewed_at as string | null) ?? null,
  }));
}
