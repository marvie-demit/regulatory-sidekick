-- ============================================================================
-- 0005_access_code_raw.sql
-- Store the raw access code (not just its hash) so the platform-admin console
-- can re-display and copy a code / redeem link at any time. Codes are revocable
-- grant tokens visible only to platform admins (access_codes is RLS-locked), not
-- secrets. Safe to re-run. Apply in the Supabase SQL editor.
-- ============================================================================
alter table access_codes add column if not exists code text;

notify pgrst, 'reload schema';
