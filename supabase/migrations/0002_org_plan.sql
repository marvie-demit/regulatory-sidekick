-- ============================================================================
-- 0002_org_plan.sql — access tier per organization.
-- Additive + re-runnable (safe to paste again). See the access model:
--   'explore'    = free Explore tier (shop window, 1 sample activity + 1 doc group)
--   'full'       = paid "Full access" (everything)
--   'enterprise' = reserved for later
-- ============================================================================

alter table public.organizations
  add column if not exists plan text not null default 'explore';

alter table public.organizations
  drop constraint if exists organizations_plan_check;
alter table public.organizations
  add constraint organizations_plan_check
  check (plan in ('explore', 'full', 'enterprise'));

-- Let PostgREST see the new column immediately.
notify pgrst, 'reload schema';
