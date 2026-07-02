-- ============================================================================
-- 0007_lock_plan_columns.sql — close the paywall bypass.
-- The org_update RLS policy lets an org admin UPDATE their organization row.
-- With table-level UPDATE granted to `authenticated` (Supabase default), that
-- also allowed an admin to PATCH organizations.plan / plan_expires_at via
-- PostgREST and grant themselves full/enterprise access for free.
--
-- Fix: drop table-level UPDATE and re-grant ONLY the columns an admin may
-- legitimately edit (name, slug). Plan changes now happen exclusively through
-- the platform-admin console (service role) and redeem_access_code
-- (SECURITY DEFINER) — both of which bypass column grants.
-- Idempotent; safe to re-run.
-- ============================================================================
begin;

revoke update on public.organizations from authenticated, anon;
grant  update (name, slug) on public.organizations to authenticated;

commit;
