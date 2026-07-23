-- ============================================================================
-- 0013_agentic_entitlement.sql — agent/MCP access as a SEPARATE entitlement.
--
-- Machine access is no longer part of the licence. It is its own paid offering
-- (the agentic QARA product) that the PLATFORM admin switches on per workspace.
-- Modelled as an entitlement, NOT another `plan` value, because it is orthogonal:
-- a workspace has full access AND (optionally) agent access.
--
-- Defaults to FALSE, deliberately: after this migration nobody has agent access
-- until it is granted — including your own workspace. Existing keys stay in the
-- table and go inert (the API gate runs per request), so switching the
-- entitlement back on restores them without re-issuing anything.
--
-- No grant statements needed: 0007 revoked table-level UPDATE on organizations
-- and 0012 re-granted only the profile columns, so these new columns are
-- unwritable by `authenticated` by construction. A workspace cannot switch on
-- its own entitlement — only the service role (platform admin) can.
-- Idempotent; safe to re-run.
-- ============================================================================
begin;

alter table public.organizations
  add column if not exists agentic_enabled    boolean not null default false,
  -- NULL = no expiry. Mirrors plan_expires_at so a lapsed subscription
  -- silently stops working the same way a lapsed licence does.
  add column if not exists agentic_expires_at timestamptz;

commit;
