import { cache } from "react";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { Brand } from "@/lib/partners/theme";

// Resolving "whose brand is this request wearing?".
//
// The header is written by the proxy from the request Host (Phase 4). Until that
// lands it is never present, so getRequestBrand() short-circuits to null and
// costs ZERO queries — this module is inert in production today, and the
// partner console gets its brand explicitly instead (see getBrandForPartner).
//
// TRUST: the proxy DELETES any inbound x-rs-partner-slug before setting its own,
// so a client cannot forge it. Even so, this value must never grant anything.
// It selects a colour scheme. Authorisation always comes from partner_members
// and RLS — assume an attacker controls this string and nothing changes.
export const PARTNER_SLUG_HEADER = "x-rs-partner-slug";

const SLUG = /^[a-z0-9][a-z0-9-]{1,30}$/;

export const getBrandBySlug = cache(async function (
  slug: string,
): Promise<Brand | null> {
  if (!SLUG.test(slug)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("partner_brand_by_slug", { p_slug: slug })
    .maybeSingle();
  // Any failure — unknown slug, migration not applied, DB hiccup — must fall
  // through to the house palette. A branding lookup can never break a page.
  if (error || !data) return null;

  const r = data as Record<string, unknown>;
  return {
    slug: r.slug as string,
    name: r.name as string,
    wordmark: (r.wordmark as string | null) ?? null,
    logoUrl: logoUrlFor(r.logo_path as string | null),
    logoAlt: (r.logo_alt as string | null) ?? null,
    primary: (r.brand_primary as string | null) ?? null,
    mid: (r.brand_mid as string | null) ?? null,
    accent: (r.brand_accent as string | null) ?? null,
    surface: (r.brand_surface as string | null) ?? null,
  };
});

/** Public URL for a logo in the `brand` bucket (0017). */
export function logoUrlFor(path: string | null | undefined): string | null {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (!base) return null;
  return `${base}/storage/v1/object/public/brand/${path}`;
}

/**
 * A partner's own brand, for the partner console. Reads the row directly under
 * the pt_select policy (0015) — it's their own record, so no definer projection
 * is needed here. This is what makes branding visible before subdomains exist.
 */
export const getBrandForPartner = cache(async function (
  partnerId: string,
): Promise<Brand | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("partners")
    .select(
      "slug, name, wordmark, logo_path, logo_alt, brand_primary, brand_mid, brand_accent, brand_surface",
    )
    .eq("id", partnerId)
    .maybeSingle();
  if (error || !data) return null;

  const r = data as Record<string, unknown>;
  return {
    slug: r.slug as string,
    name: r.name as string,
    wordmark: (r.wordmark as string | null) ?? null,
    logoUrl: logoUrlFor(r.logo_path as string | null),
    logoAlt: (r.logo_alt as string | null) ?? null,
    primary: (r.brand_primary as string | null) ?? null,
    mid: (r.brand_mid as string | null) ?? null,
    accent: (r.brand_accent as string | null) ?? null,
    surface: (r.brand_surface as string | null) ?? null,
  };
});

export const getRequestPartnerSlug = cache(async function (): Promise<
  string | null
> {
  const slug = (await headers()).get(PARTNER_SLUG_HEADER);
  return slug && SLUG.test(slug) ? slug : null;
});

/**
 * Brand for the current request, or null on the canonical host. Zero queries
 * when there's no slug, which today is every request — so adding this to a
 * layout costs nothing until subdomains ship.
 */
export const getRequestBrand = cache(async function (): Promise<Brand | null> {
  const slug = await getRequestPartnerSlug();
  return slug ? getBrandBySlug(slug) : null;
});
