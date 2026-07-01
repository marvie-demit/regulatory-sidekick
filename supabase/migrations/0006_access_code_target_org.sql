-- ============================================================================
-- 0006_access_code_target_org.sql
-- Org-locked access codes: a code minted for a specific organisation can only
-- be redeemed by that org. Generic codes (target_org_id null) still work for
-- any org. Updates redeem_access_code to enforce the lock. Safe to re-run.
-- Apply in the Supabase SQL editor.
-- ============================================================================
alter table access_codes
  add column if not exists target_org_id uuid references organizations(id) on delete cascade;

create or replace function public.redeem_access_code(p_raw_code text, p_org uuid)
  returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid  uuid := (select auth.uid());
  v_hash text;
  v_code public.access_codes;
  v_exp  timestamptz;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from public.memberships m
                 where m.org_id = p_org and m.user_id = v_uid and m.role = 'admin') then
    raise exception 'must be an admin of this organization';
  end if;

  v_hash := encode(sha256(convert_to(p_raw_code, 'UTF8')), 'hex');
  select * into v_code from public.access_codes where code_hash = v_hash;
  if not found then raise exception 'invalid code'; end if;
  if v_code.target_org_id is not null and v_code.target_org_id <> p_org then
    raise exception 'this code is for a different organization';
  end if;
  if v_code.expires_at is not null and v_code.expires_at < now() then
    raise exception 'this code has expired';
  end if;
  if v_code.used_count >= v_code.max_uses then raise exception 'this code has already been used'; end if;
  if exists (select 1 from public.code_redemptions r where r.code_id = v_code.id and r.org_id = p_org) then
    raise exception 'this organization has already redeemed this code';
  end if;

  v_exp := case when v_code.grant_days is not null
                then now() + make_interval(days => v_code.grant_days) else null end;
  update public.organizations set plan = v_code.plan, plan_expires_at = v_exp where id = p_org;
  insert into public.code_redemptions(code_id, org_id, redeemed_by) values (v_code.id, p_org, v_uid);
  update public.access_codes set used_count = used_count + 1 where id = v_code.id;
  insert into public.audit_log(org_id, actor_id, action, entity_type, entity_id, detail)
    values (p_org, v_uid, 'plan.redeem', 'access_code', v_code.id::text,
            jsonb_build_object('plan', v_code.plan, 'plan_expires_at', v_exp));
  return jsonb_build_object('plan', v_code.plan, 'plan_expires_at', v_exp);
end; $$;
revoke all on function public.redeem_access_code(text, uuid) from public, anon;
grant execute on function public.redeem_access_code(text, uuid) to authenticated;

notify pgrst, 'reload schema';
