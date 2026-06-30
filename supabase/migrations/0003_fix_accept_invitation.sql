-- ============================================================================
-- 0003_fix_accept_invitation.sql
-- Fix: accept_invitation() ran under search_path='' but called pgcrypto's
-- digest(), which lives in the (unlisted) extensions schema -> "function
-- digest(text, unknown) does not exist", so no invite could be accepted.
-- Use the built-in pg_catalog sha256() instead (identical hash, no extension).
-- Safe to re-run. Apply in the Supabase SQL editor (or `supabase db push`).
-- ============================================================================
create or replace function public.accept_invitation(p_raw_token text) returns uuid
  language plpgsql security definer set search_path = '' as $$
declare v_inv public.invitations; v_uid uuid := (select auth.uid()); v_hash text;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  v_hash := encode(sha256(convert_to(p_raw_token, 'UTF8')), 'hex');
  select * into v_inv from public.invitations
    where token_hash = v_hash and accepted_at is null and expires_at > now();
  if not found then raise exception 'invalid or expired invitation'; end if;
  insert into public.memberships(org_id, user_id, role)
    values (v_inv.org_id, v_uid, v_inv.role)
    on conflict (org_id, user_id) do nothing;
  update public.invitations set accepted_at = now(), accepted_by = v_uid where id = v_inv.id;
  insert into public.audit_log(org_id, actor_id, action, entity_type, entity_id)
    values (v_inv.org_id, v_uid, 'invitation.accept', 'invitation', v_inv.id::text);
  return v_inv.org_id;
end; $$;
revoke all on function public.accept_invitation(text) from public, anon;
grant execute on function public.accept_invitation(text) to authenticated;

notify pgrst, 'reload schema';
