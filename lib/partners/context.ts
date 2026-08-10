import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getRequestPartnerSlug } from "@/lib/partners/brand";
import { ACTIVE_PARTNER_COOKIE } from "@/lib/constants";

// Who is this user, as a partner? Mirrors lib/auth/org.ts, deliberately as a
// SEPARATE module: partner identity and org identity must never be conflated,
// and neither may import lib/auth/platform.ts (platform admin is an env
// allowlist so it can't be escalated through the database — see 0015's header).

export type PartnerRole = "admin" | "member";

export type PartnerContext = {
  id: string;
  name: string;
  slug: string;
  kind: string;
  status: string;
  role: PartnerRole;
  staffLimit: number;
  defaultGrantDays: number | null;
  maxGrantDays: number | null;
  defaultRedeemDays: number | null;
};

// RLS scopes this to the caller (ptm_select + pt_select in 0015), so there is no
// user_id filter — same shape as getMemberships().
export const getPartnerMemberships = cache(async function (): Promise<
  PartnerContext[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("partner_members")
    .select(
      "role, partners(id, name, slug, kind, status, staff_limit, default_grant_days, max_grant_days, default_redeem_days)",
    )
    .order("created_at", { ascending: true });

  // A partner-less user is the common case, and 0015 may not be applied yet on
  // some environment — either way this must be an empty list, never a throw:
  // every caller uses it to decide routing, and a throw here would break the
  // app shell for ordinary customers who have nothing to do with partners.
  if (error) return [];

  return (data ?? [])
    .map((row) => {
      const r = row as unknown as {
        role: string;
        partners: Record<string, unknown> | Record<string, unknown>[] | null;
      };
      // PostgREST returns the embed as an object or a one-element array.
      const p = Array.isArray(r.partners) ? r.partners[0] : r.partners;
      if (!p) return null;
      return {
        id: p.id as string,
        name: p.name as string,
        slug: p.slug as string,
        kind: (p.kind as string) ?? "other",
        status: (p.status as string) ?? "active",
        role: (r.role === "admin" ? "admin" : "member") as PartnerRole,
        staffLimit: (p.staff_limit as number) ?? 10,
        defaultGrantDays: (p.default_grant_days as number | null) ?? null,
        maxGrantDays: (p.max_grant_days as number | null) ?? null,
        defaultRedeemDays: (p.default_redeem_days as number | null) ?? null,
      };
    })
    .filter((p): p is PartnerContext => p !== null);
});

export const getActivePartner = cache(async function (): Promise<PartnerContext | null> {
  const partners = await getPartnerMemberships();
  if (partners.length === 0) return null;
  const wanted = (await cookies()).get(ACTIVE_PARTNER_COOKIE)?.value;
  return partners.find((p) => p.id === wanted) ?? partners[0];
});

/**
 * THE partner for this request — the one every partner page and action must use.
 *
 * On a partner subdomain the HOST decides, not the cookie: someone who staffs
 * two partners must not see Beta's codes at acme.<apex> just because their
 * cookie points at Beta. On the canonical host the cookie decides.
 *
 * Layout and pages both call this so they can never disagree about who they're
 * rendering — the layout gating one partner while a page loads another would be
 * a data leak, not a cosmetic bug.
 */
export const getScopedPartner = cache(async function (): Promise<PartnerContext | null> {
  const hostSlug = await getRequestPartnerSlug();
  if (!hostSlug) return getActivePartner();
  const partners = await getPartnerMemberships();
  return partners.find((p) => p.slug === hostSlug) ?? null;
});

/** Cheap routing check — "should this user be sent to /partner at all?" */
export async function hasPartnerAccess(): Promise<boolean> {
  return (await getPartnerMemberships()).length > 0;
}

// The gate every partner server action starts with. Suspension is checked here
// too, so a suspended partner's console is read-only rather than half-working.
export async function requirePartnerAdmin(): Promise<
  { error: string } | { partner: PartnerContext }
> {
  const partner = await getScopedPartner();
  if (!partner) return { error: "No active partner account." };
  if (partner.role !== "admin")
    return { error: "Only partner admins can do that." };
  if (partner.status !== "active")
    return { error: "This partner account is suspended — contact us." };
  return { partner };
}
