-- ============================================================================
-- 0008_lock_audit_log.sql — make the audit trail non-forgeable.
-- The au_insert RLS policy let any member INSERT audit_log rows via PostgREST.
-- actor_id was forced to the caller (no impersonation), but a member could
-- still inject self-attributed rows with arbitrary `action` labels, muddying a
-- compliance-relevant trail.
--
-- Fix: revoke INSERT from end users entirely. Audit rows now come ONLY from
-- server-controlled paths — the app's Server Actions / route handlers writing
-- with the service role, and the SECURITY DEFINER RPCs — all of which bypass
-- this grant. SELECT stays (au_select) so the org audit-log view still works.
-- Idempotent; safe to re-run.
-- ============================================================================
begin;

revoke insert on public.audit_log from authenticated, anon;
drop policy if exists au_insert on public.audit_log;

commit;
