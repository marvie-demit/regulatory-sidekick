-- ============================================================================
-- 0026_rate_take_grants.sql — readiness_rate_take() was callable by anon.
--
-- THE BUG, and it was mine. 0025 ended with:
--
--     revoke all on function public.readiness_rate_take(text, int, int) from public;
--     grant  execute on function public.readiness_rate_take(text, int, int) to service_role;
--
-- which reads as "service role only" and is not. `revoke ... from public`
-- removes the implicit grant held by the PUBLIC pseudo-role. It does not touch
-- an EXPLICIT grant to `anon`, and this project's Supabase has
-- `alter default privileges in schema public grant all on functions to anon,
-- authenticated, service_role`, so the function was granted to anon at CREATE
-- time and the revoke never reached it. Confirmed against the live database:
-- an anon-keyed POST to /rest/v1/rpc/readiness_rate_take returned 200.
--
-- WHY IT MATTERS. The function is security definer and, unlike every other
-- definer function in this schema, it performs NO caller check — it had no
-- reason to, on the assumption that only the service role could reach it. So
-- an unauthenticated caller could insert unbounded rows into
-- readiness_attempts: an open write primitive, in the table whose entire job is
-- to bound writes. No data is exposed by it — it returns a boolean and reads
-- nothing but its own counts.
--
-- WHY THE REST OF THE SCHEMA IS NOT AFFECTED. The established pattern here is
-- to authorise inside the function rather than lean on grants:
-- partner_mint_codes takes `auth.uid()`, raises 'not authenticated' when it is
-- null and then checks partner_members; redeem_access_code does the same. Those
-- are callable by anon and refuse anon. This function was the one that trusted
-- a grant, which is exactly the assumption that turned out to be wrong.
--
-- 0024's readiness_result_by_token() and 0025's readiness_confirm_consent() are
-- INTENTIONALLY anon-callable — the shared result page and the confirmation
-- link are unauthenticated by design — and both are deliberately narrow. They
-- are re-granted below so this file states the whole intended grant map in one
-- place rather than leaving it spread across three migrations.
--
-- Requires 0025. Idempotent; safe to re-run.
-- ============================================================================
begin;

-- The actual fix: name the roles, do not rely on PUBLIC.
revoke execute on function public.readiness_rate_take(text, int, int)
  from anon, authenticated;
revoke all     on function public.readiness_rate_take(text, int, int)
  from public;
grant  execute on function public.readiness_rate_take(text, int, int)
  to service_role;

-- Unchanged, and restated so the intended map is legible in one file:
-- these two ARE public, by design.
grant execute on function public.readiness_result_by_token(text)
  to anon, authenticated;
grant execute on function public.readiness_confirm_consent(text)
  to anon, authenticated;

-- Belt and braces for the bucket itself. The table already has RLS on with no
-- policies, so this changes nothing today; it means a future `create policy`
-- on readiness_attempts cannot quietly hand it to a role that was never meant
-- to hold the grant.
revoke all on table public.readiness_attempts from anon, authenticated;

notify pgrst, 'reload schema';
commit;

-- Verify from a shell, with the project's PUBLIC anon key:
--
--   curl -s -o /dev/null -w '%{http_code}\n' -X POST \
--     "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/rpc/readiness_rate_take" \
--     -H "apikey: $ANON" -H "Authorization: Bearer $ANON" \
--     -H 'Content-Type: application/json' \
--     -d '{"p_ip_hash":"'"$(printf 'a%.0s' {1..64})"'","p_max":1,"p_window_seconds":60}'
--
-- Must print 401 (it printed 200 before this migration). The other two must
-- still answer 200, since the result page and the confirmation link depend on
-- them.
