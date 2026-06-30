-- ============================================================================
-- 0004_access_codes.sql
-- Platform-owner "instance admin" grants of full access via redeemable codes.
-- Adds: organizations.plan_expires_at; access_codes + code_redemptions tables;
-- redeem_access_code() RPC. RLS keeps codes invisible to normal users; the
-- platform admin mints via the service role, orgs redeem via the RPC.
-- Apply in the Supabase SQL editor BEFORE deploying the matching app code
-- (getMemberships starts reading plan_expires_at). Safe to re-run.
-- ============================================================================
begin;

alter table organizations add column if not exists plan_expires_at timestamptz;

create table if not exists access_codes (
  id         uuid primary key default gen_random_uuid(),
  code_hash  text unique not null,                 -- sha256 of the raw code; raw is shared, never stored
  plan       text not null check (plan in ('full', 'enterprise')),
  grant_days int,                                  -- access duration once redeemed; null = indefinite
  max_uses   int  not null default 1,
  used_count int  not null default 0,
  expires_at timestamptz,                          -- code is redeemable until this; null = no deadline
  note       text,                                 -- e.g. customer / deal name
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists code_redemptions (
  id          uuid primary key default gen_random_uuid(),
  code_id     uuid not null references access_codes(id) on delete cascade,
  org_id      uuid not null references organizations(id) on delete cascade,
  redeemed_by uuid references auth.users(id),
  redeemed_at timestamptz not null default now(),
  unique (code_id, org_id)
);

alter table access_codes      enable row level security;
alter table code_redemptions  enable row level security;
-- access_codes: no policy for anon/authenticated -> only the service role (platform
-- admin) and SECURITY DEFINER functions can touch it. code_redemptions: a member
-- may see their own org's history; inserts happen inside the definer RPC.
drop policy if exists cr_select on code_redemptions;
create policy cr_select on code_redemptions for select using ((select app.is_member(org_id)));

-- Redeem: caller must be an admin of the target org. Sets the org's plan + expiry.
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
commit;
