import { createAdminClient } from "@/lib/supabase/admin";
import { emailsByUserId } from "@/lib/admin/data";
import { logoUrlFor } from "@/lib/partners/brand";

// Platform-admin reads (service role). Only ever called from the gated /admin
// page — the partner-facing equivalents go through the RLS-scoped RPCs in 0015
// (partner_overview / partner_portfolio), never through this module.

export type PartnerStaff = { email: string | null; role: string };

export type AdminPartner = {
  id: string;
  name: string;
  slug: string;
  kind: string;
  status: string;
  licenceAllowance: number;
  /** seats held by live codes; see app.partner_seats_consumed in 0015 */
  consumed: number;
  /** clamped at 0 — an over-allocated partner shows overBy instead */
  remaining: number;
  /** > 0 when the allowance was lowered below what is already issued */
  overBy: number;
  staffLimit: number;
  defaultGrantDays: number | null;
  maxGrantDays: number | null;
  defaultRedeemDays: number | null;
  contactEmail: string | null;
  note: string | null;
  liveCodes: number;
  revokedCodes: number;
  redemptions: number;
  staff: PartnerStaff[];
  createdAt: string;
  /** white-label (0015 columns, 0017 lookup) — null until the platform admin sets them */
  brandPrimary: string | null;
  brandMid: string | null;
  brandAccent: string | null;
  brandSurface: string | null;
  wordmark: string | null;
  logoUrl: string | null;
  logoAlt: string | null;
};

const PARTNER_COLS =
  "id, name, slug, kind, status, licence_allowance, staff_limit, " +
  "default_grant_days, max_grant_days, default_redeem_days, " +
  "contact_email, note, created_at, " +
  "brand_primary, brand_mid, brand_accent, brand_surface, wordmark, logo_path, logo_alt";

/**
 * Mirrors app.partner_seats_consumed (0015) so the console can show the number
 * without a round trip per partner. The DB stays the authority — the mint RPC
 * re-computes it under a row lock and is what actually blocks an overspend.
 */
function seatsFor(c: {
  max_uses: number;
  used_count: number;
  revoked_at: string | null;
  expires_at: string | null;
}): number {
  if (c.revoked_at) return c.used_count;
  if (c.expires_at && new Date(c.expires_at) < new Date()) return c.used_count;
  return c.max_uses;
}

export async function listPartners(): Promise<AdminPartner[]> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("partners")
    .select(PARTNER_COLS)
    .order("created_at", { ascending: false })
    .limit(200);
  // Resilient to 0015 not being applied yet, the same way listOrgs/listAccessCodes
  // are: the admin page must still render rather than 500.
  if (error) return [];
  const rows = (data ?? []) as unknown as Record<string, unknown>[];
  if (rows.length === 0) return [];

  const ids = rows.map((p) => p.id as string);

  const [{ data: codeRows }, { data: memberRows }, emailById] = await Promise.all([
    admin
      .from("access_codes")
      .select("partner_id, max_uses, used_count, revoked_at, expires_at")
      .in("partner_id", ids),
    admin.from("partner_members").select("partner_id, user_id, role").in("partner_id", ids),
    emailsByUserId(),
  ]);

  type CodeRow = {
    partner_id: string;
    max_uses: number;
    used_count: number;
    revoked_at: string | null;
    expires_at: string | null;
  };
  const stats = new Map<
    string,
    { consumed: number; live: number; revoked: number; redemptions: number }
  >();
  ((codeRows ?? []) as CodeRow[]).forEach((c) => {
    const s = stats.get(c.partner_id) ?? {
      consumed: 0,
      live: 0,
      revoked: 0,
      redemptions: 0,
    };
    s.consumed += seatsFor(c);
    s.redemptions += c.used_count;
    if (c.revoked_at) s.revoked += 1;
    else s.live += 1;
    stats.set(c.partner_id, s);
  });

  const rank = (r: string) => (r === "admin" ? 0 : 1);
  const byPartner = new Map<string, PartnerStaff[]>();
  ((memberRows ?? []) as { partner_id: string; user_id: string; role: string }[]).forEach(
    (m) => {
      const list = byPartner.get(m.partner_id) ?? [];
      list.push({ email: emailById.get(m.user_id) ?? null, role: m.role });
      byPartner.set(m.partner_id, list);
    },
  );

  return rows.map((p) => {
    const id = p.id as string;
    const s = stats.get(id) ?? { consumed: 0, live: 0, revoked: 0, redemptions: 0 };
    const allowance = (p.licence_allowance as number) ?? 0;
    return {
      id,
      name: p.name as string,
      slug: p.slug as string,
      kind: (p.kind as string) ?? "other",
      status: (p.status as string) ?? "active",
      licenceAllowance: allowance,
      consumed: s.consumed,
      remaining: Math.max(allowance - s.consumed, 0),
      overBy: Math.max(s.consumed - allowance, 0),
      staffLimit: (p.staff_limit as number) ?? 10,
      defaultGrantDays: (p.default_grant_days as number | null) ?? null,
      maxGrantDays: (p.max_grant_days as number | null) ?? null,
      defaultRedeemDays: (p.default_redeem_days as number | null) ?? null,
      contactEmail: (p.contact_email as string | null) ?? null,
      note: (p.note as string | null) ?? null,
      liveCodes: s.live,
      revokedCodes: s.revoked,
      redemptions: s.redemptions,
      staff: (byPartner.get(id) ?? []).sort((a, b) => rank(a.role) - rank(b.role)),
      createdAt: p.created_at as string,
      brandPrimary: (p.brand_primary as string | null) ?? null,
      brandMid: (p.brand_mid as string | null) ?? null,
      brandAccent: (p.brand_accent as string | null) ?? null,
      brandSurface: (p.brand_surface as string | null) ?? null,
      wordmark: (p.wordmark as string | null) ?? null,
      logoUrl: logoUrlFor(p.logo_path as string | null),
      logoAlt: (p.logo_alt as string | null) ?? null,
    };
  });
}
