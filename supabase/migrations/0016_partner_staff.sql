-- ============================================================================
-- 0016_partner_staff.sql — partner staff management.
--
-- 0015 revoked INSERT/UPDATE/DELETE on partner_members from `authenticated`, so
-- a partner admin cannot write that table directly. These two SECURITY DEFINER
-- RPCs are the only path, which means a bug in an app-layer gate still can't
-- change a membership: app.has_partner_role is re-checked inside the function.
--
-- The alternative — a server action holding the service-role key — was rejected
-- deliberately. Platform admins are an env allowlist (a handful of people);
-- partner admins are DB rows and there will be many, so a service-role path
-- triggered by a partner admin turns any gate bug into full database access.
--
-- The two rules mirror lib/auth/team.ts removeMember: you cannot remove
-- yourself, and you cannot remove the last admin.
-- Apply in the SQL editor BEFORE deploying the matching app code. Idempotent.
-- ============================================================================
begin;

create or replace function public.remove_partner_member(p_partner uuid, p_user uuid)
  returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid    uuid := (select auth.uid());
  v_role   text;
  v_admins int;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if not (select app.has_partner_role(p_partner, 'admin')) then
    raise exception 'must be an admin of this partner';
  end if;
  if p_user = v_uid then raise exception 'you can''t remove yourself'; end if;

  select role into v_role from public.partner_members
    where partner_id = p_partner and user_id = p_user;
  if v_role is null then raise exception 'not a member of this partner'; end if;

  select count(*) into v_admins from public.partner_members
    where partner_id = p_partner and role = 'admin';
  if v_role = 'admin' and v_admins <= 1 then
    raise exception 'you can''t remove the last admin';
  end if;

  delete from public.partner_members where partner_id = p_partner and user_id = p_user;
  insert into public.partner_audit(partner_id, actor_id, action, entity_type, entity_id)
    values (p_partner, v_uid, 'staff.remove', 'partner_member', p_user::text);
end; $$;
revoke all on function public.remove_partner_member(uuid, uuid) from public, anon;
grant execute on function public.remove_partner_member(uuid, uuid) to authenticated;

create or replace function public.set_partner_member_role(
  p_partner uuid, p_user uuid, p_role text
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid    uuid := (select auth.uid());
  v_role   text;
  v_admins int;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if p_role not in ('admin', 'member') then raise exception 'invalid role'; end if;
  if not (select app.has_partner_role(p_partner, 'admin')) then
    raise exception 'must be an admin of this partner';
  end if;

  select role into v_role from public.partner_members
    where partner_id = p_partner and user_id = p_user;
  if v_role is null then raise exception 'not a member of this partner'; end if;
  if v_role = p_role then return; end if;

  -- Same invariant as removal: a partner must never be left without an admin,
  -- including by the last admin demoting themselves.
  if v_role = 'admin' then
    select count(*) into v_admins from public.partner_members
      where partner_id = p_partner and role = 'admin';
    if v_admins <= 1 then raise exception 'you can''t demote the last admin'; end if;
  end if;

  update public.partner_members set role = p_role
    where partner_id = p_partner and user_id = p_user;
  insert into public.partner_audit(partner_id, actor_id, action, entity_type, entity_id, detail)
    values (p_partner, v_uid, 'staff.role', 'partner_member', p_user::text,
            jsonb_build_object('from', v_role, 'to', p_role));
end; $$;
revoke all on function public.set_partner_member_role(uuid, uuid, text) from public, anon;
grant execute on function public.set_partner_member_role(uuid, uuid, text) to authenticated;

-- ============================================================================
-- Corrects partner_revoke_code from 0015: a code whose redeem-by window has
-- already lapsed has ALREADY released its unredeemed seats (that's the
-- app.partner_seats_consumed rule), so revoking it frees nothing. The old
-- version reported max_uses - used_count regardless and told the partner
-- licences had come back when the number hadn't moved.
-- ============================================================================
create or replace function public.partner_revoke_code(p_code uuid)
  returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid    uuid := (select auth.uid());
  v_c      public.access_codes;
  v_lapsed boolean;
  v_freed  int;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select * into v_c from public.access_codes where id = p_code;
  if not found or v_c.partner_id is null then raise exception 'unknown code'; end if;
  if not (select app.has_partner_role(v_c.partner_id, 'admin')) then
    raise exception 'must be an admin of this partner';
  end if;
  if v_c.revoked_at is not null then return jsonb_build_object('freed', 0); end if;

  v_lapsed := v_c.expires_at is not null and v_c.expires_at < now();
  v_freed  := case when v_lapsed then 0
                   else greatest(v_c.max_uses - v_c.used_count, 0) end;

  update public.access_codes set revoked_at = now(), revoked_by = v_uid where id = p_code;

  insert into public.partner_audit(partner_id, actor_id, action, entity_type, entity_id, detail)
    values (v_c.partner_id, v_uid, 'codes.revoke', 'access_code', p_code::text,
            jsonb_build_object('freed', v_freed, 'used_count', v_c.used_count,
                               'already_lapsed', v_lapsed));

  return jsonb_build_object('freed', v_freed);
end; $$;
revoke all on function public.partner_revoke_code(uuid) from public, anon;
grant execute on function public.partner_revoke_code(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
