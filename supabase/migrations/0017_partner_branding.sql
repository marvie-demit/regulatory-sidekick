-- ============================================================================
-- 0017_partner_branding.sql — white-label lookup + logo storage.
--
-- The branding COLUMNS already exist (0015) with their '^#[0-9a-fA-F]{6}$'
-- check constraints. What's missing is a way to read them, and somewhere to put
-- a logo.
--
-- Branding must be readable BEFORE sign-in — a partner's login and redeem pages
-- are exactly the ones that need it — so this has to reach `anon`. It is a
-- narrow SECURITY DEFINER projection rather than an RLS policy on `partners`,
-- because a policy would expose the whole row: licence_allowance, contact_email
-- and staff_limit are nobody's business but ours and the partner's.
--
-- Suspended partners resolve to nothing, so a suspended account stops looking
-- like a live product.
-- Apply in the SQL editor BEFORE deploying the matching app code. Idempotent.
-- ============================================================================
begin;

create or replace function public.partner_brand_by_slug(p_slug text)
  returns table (
    slug          text,
    name          text,
    wordmark      text,
    logo_path     text,
    logo_alt      text,
    brand_primary text,
    brand_mid     text,
    brand_accent  text,
    brand_surface text
  )
  language sql stable security definer set search_path = '' as $$
  select p.slug, p.name, p.wordmark, p.logo_path, p.logo_alt,
         p.brand_primary, p.brand_mid, p.brand_accent, p.brand_surface
  from public.partners p
  where p.slug = lower(p_slug) and p.status = 'active';
$$;
revoke all on function public.partner_brand_by_slug(text) from public;
grant execute on function public.partner_brand_by_slug(text) to anon, authenticated;

-- ============ logo storage ============
-- Public bucket: a logo renders on the sign-in page, before any session exists,
-- so it cannot be behind a signed URL. Path convention mirrors the `evidence`
-- bucket (0001): the id lives in the path, here partner/<partner_id>/<file>.
insert into storage.buckets (id, name, public)
  values ('brand', 'brand', true)
  on conflict (id) do nothing;

drop policy if exists brand_obj_select on storage.objects;
create policy brand_obj_select on storage.objects for select
  using (bucket_id = 'brand');
-- No insert/update/delete policy on purpose: only the platform admin uploads a
-- logo, and that path holds the service role. A partner cannot replace their own
-- artwork without us, which is what you want for something that renders on a
-- page carrying our product.

notify pgrst, 'reload schema';
commit;
