-- ============================================================================
-- 0023_agentic_access_codes.sql — an access code may grant agent access.
--
-- Until now agent access (organizations.agentic_enabled + agentic_expires_at,
-- 0013) had exactly two sources: the Stripe subscription webhook, and a platform
-- admin flipping it by hand in setOrgAgentAccess. Codes only ever set `plan`.
--
-- That left no way to hand it out at scale — no trial for a customer who already
-- holds a licence, and nothing a partner could include for their portfolio.
--
-- Two shapes are new here, and each carries its own reasoning:
--
--   AGENT-ONLY CODES. `plan` becomes nullable, so a code can grant the add-on
--   and nothing else. That is what makes a trial possible at all: the customer
--   who most wants one already has a licence, and every code until now
--   overwrote the plan. A CHECK keeps a code from granting nothing.
--
--   A SEPARATE PARTNER ALLOWANCE. Not weighted seats on the licence allowance.
--   Had one licence seat been able to carry agent access, a partner would be
--   giving away a €150/month product nobody paid for — the same hole the
--   Connect design has to close on partner_seats_consumed. Two allowances, two
--   counters, two checks.
--
-- Requires 0004 (access_codes), 0013 (the entitlement) and 0015 (partners).
-- Idempotent; safe to re-run.
-- ============================================================================
begin;

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------

-- A code may now grant a licence, agent access, or both — but never nothing.
alter table public.access_codes alter column plan drop not null;

alter table public.access_codes
  add column if not exists agentic boolean not null default false;
alter table public.access_codes
  add column if not exists agentic_days int;

-- Mirrors grant_days exactly, including NULL meaning INDEFINITE, and matches the
-- 1–3650 range setOrgAgentAccess already enforces — so the code path and the
-- manual path cannot drift apart.
alter table public.access_codes drop constraint if exists access_codes_agentic_days_chk;
alter table public.access_codes
  add constraint access_codes_agentic_days_chk
  check (agentic_days is null or agentic_days between 1 and 3650);

alter table public.access_codes drop constraint if exists access_codes_grants_chk;
alter table public.access_codes
  add constraint access_codes_grants_chk
  check (plan is not null or agentic);

-- Partners buy agentic seats separately from licence seats.
alter table public.partners
  add column if not exists agentic_allowance int not null default 0;
alter table public.partners drop constraint if exists partners_agentic_allowance_chk;
alter table public.partners
  add constraint partners_agentic_allowance_chk
  check (agentic_allowance between 0 and 100000);

-- ---------------------------------------------------------------------------
-- The second counter.
--
-- Deliberately a separate function rather than a parameter on
-- partner_seats_consumed. Two allowances that must never be confused are safer
-- as two functions a reviewer sees side by side — the same reasoning that keeps
-- partner_portfolio narrow instead of growing a "give me everything" flag.
-- The revoked/expired formula is identical; only the filter differs.
-- ---------------------------------------------------------------------------
create or replace function app.partner_agentic_seats_consumed(p_partner uuid) returns int
  language sql stable security definer set search_path = '' as $$
  select coalesce(sum(case
    when c.revoked_at is not null                          then c.used_count
    when c.expires_at is not null and c.expires_at < now() then c.used_count
    else c.max_uses
  end), 0)::int
  from public.access_codes c
  where c.partner_id = p_partner and c.agentic;
$$;
revoke all on function app.partner_agentic_seats_consumed(uuid) from public, anon;
grant execute on function app.partner_agentic_seats_consumed(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- redeem_access_code — replaces the 0015 version.
--
-- Two behaviours are new, and the second is the one to read carefully.
--
-- 1. The plan is only touched when the code actually grants one. An agent-only
--    code must leave plan and plan_expires_at exactly as it found them.
--
-- 2. An entitlement is NEVER SHORTENED. grantAgentAccess() in
--    lib/billing/grant.ts already refuses to move agentic_expires_at backwards,
--    because Stripe redelivers and reorders events. The same rule has to hold
--    here for a different reason: a customer whose subscription runs to
--    December, redeeming a 30-day trial code, must not end up with 30 days.
--
--    The wrinkle is that NULL means two opposite things depending on
--    agentic_enabled. With it false, a null expiry means NO ACCESS. With it
--    true, a null expiry means INDEFINITE. So this is not a plain greatest():
--    indefinite has to win in both directions, which is what the CASE below
--    spells out. Getting this wrong silently downgrades a paying customer.
-- ---------------------------------------------------------------------------
create or replace function public.redeem_access_code(p_raw_code text, p_org uuid)
  returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid   uuid := (select auth.uid());
  v_hash  text;
  v_code  public.access_codes;
  v_org   public.organizations;
  v_exp   timestamptz;
  v_aexp  timestamptz;
  v_anew  timestamptz;
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
  if v_code.revoked_at is not null then raise exception 'this code has been revoked'; end if;
  if v_code.partner_id is not null and exists (
       select 1 from public.partners p where p.id = v_code.partner_id and p.status <> 'active')
  then raise exception 'this code is no longer valid'; end if;
  if v_code.expires_at is not null and v_code.expires_at < now() then
    raise exception 'this code has expired';
  end if;
  if v_code.used_count >= v_code.max_uses then raise exception 'this code has already been used'; end if;
  if exists (select 1 from public.code_redemptions r where r.code_id = v_code.id and r.org_id = p_org) then
    raise exception 'this organization has already redeemed this code';
  end if;

  -- Lock the row we are about to merge into, so two admins redeeming at once
  -- cannot both read the same expiry and one of them lose.
  select * into v_org from public.organizations where id = p_org for update;
  if not found then raise exception 'unknown organization'; end if;

  -- ---- the licence, only if this code grants one -------------------------
  if v_code.plan is not null then
    v_exp := case when v_code.grant_days is not null
                  then now() + make_interval(days => v_code.grant_days) else null end;
    update public.organizations
       set plan = v_code.plan, plan_expires_at = v_exp
     where id = p_org;
  else
    v_exp := v_org.plan_expires_at;
  end if;

  -- ---- the add-on, extending and never shortening -------------------------
  if v_code.agentic then
    v_anew := case when v_code.agentic_days is not null
                   then now() + make_interval(days => v_code.agentic_days) else null end;

    v_aexp := case
      -- the code grants indefinite: nothing beats that
      when v_anew is null then null
      -- already indefinite and still enabled: keep it
      when v_org.agentic_enabled and v_org.agentic_expires_at is null then null
      -- otherwise the later of the two dates. coalesce covers the case where
      -- the org has no entitlement yet, or a lapsed one with a null expiry.
      else greatest(coalesce(v_org.agentic_expires_at, v_anew), v_anew)
    end;

    update public.organizations
       set agentic_enabled = true, agentic_expires_at = v_aexp
     where id = p_org;
  else
    v_aexp := v_org.agentic_expires_at;
  end if;

  insert into public.code_redemptions(code_id, org_id, redeemed_by) values (v_code.id, p_org, v_uid);
  update public.access_codes set used_count = used_count + 1 where id = v_code.id;

  insert into public.audit_log(org_id, actor_id, action, entity_type, entity_id, detail)
    values (p_org, v_uid, 'plan.redeem', 'access_code', v_code.id::text,
            jsonb_build_object('plan', v_code.plan, 'plan_expires_at', v_exp,
                               'agentic', v_code.agentic,
                               'agentic_expires_at', v_aexp));

  -- Both grants are returned so the redeem UI can name what was actually given.
  -- A caller reading only `plan` still behaves as before, and now correctly
  -- reads null for an agent-only code.
  return jsonb_build_object('plan', v_code.plan, 'plan_expires_at', v_exp,
                            'agentic', v_code.agentic,
                            'agentic_expires_at', v_aexp);
end; $$;
revoke all on function public.redeem_access_code(text, uuid) from public, anon;
grant execute on function public.redeem_access_code(text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- partner_mint_codes — replaces the 0015 version.
--
-- Two new parameters, and a SECOND allowance check inside the SAME row lock the
-- function already takes. That placement is the point: concurrent mints for one
-- partner queue on `for update`, so neither allowance can be overshot by two
-- admins minting at once. Two separate checks, because the allowances are
-- separate — an agent-only code costs no licence seats, and a licence-only code
-- costs no agentic seats.
--
-- The old 6-argument signature is dropped: leaving it would let a caller reach
-- a version with no agentic check at all, which is exactly the sort of quiet
-- bypass this migration exists to prevent.
-- ---------------------------------------------------------------------------
drop function if exists public.partner_mint_codes(uuid, text[], int, int, int, text);

create or replace function public.partner_mint_codes(
  p_partner      uuid,
  p_codes        text[],
  p_max_uses     int,
  p_grant_days   int,
  p_redeem_days  int,
  p_note         text,
  p_plan         boolean default true,   -- false = agent-only code
  p_agentic      boolean default false,
  p_agentic_days int  default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid       uuid := (select auth.uid());
  v_p         public.partners;
  v_n         int  := coalesce(array_length(p_codes, 1), 0);
  v_consumed  int;
  v_aconsumed int;
  v_seats     int;
  v_batch     uuid := gen_random_uuid();
  v_grant     int;
  v_exp       timestamptz;
  v_raw       text;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  -- Re-checked HERE, not only in the server action: a definer function is a
  -- privilege boundary and must not trust its caller.
  if not (select app.has_partner_role(p_partner, 'admin')) then
    raise exception 'must be an admin of this partner';
  end if;
  if not p_plan and not p_agentic then
    raise exception 'a code must grant a licence, agent access, or both';
  end if;
  if v_n < 1 or v_n > 200 then raise exception 'mint between 1 and 200 codes at a time'; end if;
  if p_max_uses is null or p_max_uses < 1 or p_max_uses > 500 then
    raise exception 'seats per code must be between 1 and 500';
  end if;
  if p_grant_days is not null and (p_grant_days < 1 or p_grant_days > 3650) then
    raise exception 'access days must be between 1 and 3650';
  end if;
  if p_agentic_days is not null and (p_agentic_days < 1 or p_agentic_days > 3650) then
    raise exception 'agent access days must be between 1 and 3650';
  end if;
  if p_redeem_days is not null and (p_redeem_days < 1 or p_redeem_days > 365) then
    raise exception 'redeem-by must be between 1 and 365 days';
  end if;

  -- SERIALIZATION POINT. Concurrent mints for the SAME partner queue here;
  -- different partners never contend. Everything below reads a consistent world.
  select * into v_p from public.partners where id = p_partner for update;
  if not found then raise exception 'unknown partner'; end if;
  if v_p.status <> 'active' then raise exception 'this partner account is suspended'; end if;

  v_seats := v_n * p_max_uses;

  -- Licence seats, only when the code actually grants a licence.
  if p_plan then
    v_consumed := app.partner_seats_consumed(p_partner);
    if v_consumed + v_seats > v_p.licence_allowance then
      raise exception 'not enough licences: % of % remaining, this mint needs %',
        greatest(v_p.licence_allowance - v_consumed, 0), v_p.licence_allowance, v_seats;
    end if;
  else
    v_consumed := app.partner_seats_consumed(p_partner);
  end if;

  -- Agentic seats, counted and capped independently.
  v_aconsumed := app.partner_agentic_seats_consumed(p_partner);
  if p_agentic and v_aconsumed + v_seats > v_p.agentic_allowance then
    raise exception 'not enough agent seats: % of % remaining, this mint needs %',
      greatest(v_p.agentic_allowance - v_aconsumed, 0), v_p.agentic_allowance, v_seats;
  end if;

  v_grant := coalesce(p_grant_days, v_p.default_grant_days);
  if v_grant is not null and v_p.max_grant_days is not null then
    v_grant := least(v_grant, v_p.max_grant_days);
  end if;
  v_exp := case when p_redeem_days is not null and p_redeem_days > 0
                then now() + make_interval(days => p_redeem_days) else null end;

  foreach v_raw in array p_codes loop
    insert into public.access_codes
      (code_hash, code, plan, grant_days, max_uses, expires_at, note,
       created_by, partner_id, batch_id, target_org_id, agentic, agentic_days)
    values
      (encode(sha256(convert_to(v_raw, 'UTF8')), 'hex'), v_raw,
       -- HARD-CODED when present. Enterprise is a custom bundled deal granted
       -- out of band by the platform admin — never by a partner.
       case when p_plan then 'full' else null end,
       v_grant, p_max_uses, v_exp, p_note,
       v_uid, p_partner, v_batch,
       null,    -- partner codes are never org-locked
       p_agentic, p_agentic_days);
  end loop;

  insert into public.partner_audit(partner_id, actor_id, action, entity_type, entity_id, detail)
    values (p_partner, v_uid, 'codes.mint', 'code_batch', v_batch::text,
            jsonb_build_object('count', v_n, 'max_uses', p_max_uses, 'seats', v_seats,
                               'grant_days', v_grant, 'expires_at', v_exp,
                               'plan', p_plan, 'agentic', p_agentic,
                               'agentic_days', p_agentic_days));

  return jsonb_build_object('batch_id', v_batch, 'count', v_n, 'seats', v_seats,
                            'expires_at', v_exp,
                            'remaining', case when p_plan
                              then v_p.licence_allowance - v_consumed - v_seats
                              else v_p.licence_allowance - v_consumed end,
                            'agentic_remaining', case when p_agentic
                              then v_p.agentic_allowance - v_aconsumed - v_seats
                              else v_p.agentic_allowance - v_aconsumed end);
end; $$;
revoke all on function public.partner_mint_codes(uuid, text[], int, int, int, text, boolean, boolean, int)
  from public, anon;
grant execute on function public.partner_mint_codes(uuid, text[], int, int, int, text, boolean, boolean, int)
  to authenticated;

-- ---------------------------------------------------------------------------
-- partner_overview — replaces the 0015 version, adding the agentic triple.
-- The partner console reads its allowance meters from here, so without this the
-- second allowance would be invisible to the people spending it.
-- ---------------------------------------------------------------------------
create or replace function public.partner_overview(p_partner uuid) returns jsonb
  language sql stable security definer set search_path = '' as $$
  select case when (select app.is_partner_member(p_partner)) then
    jsonb_build_object(
      'allowance',   p.licence_allowance,
      'consumed',    app.partner_seats_consumed(p_partner),
      'remaining',   greatest(p.licence_allowance - app.partner_seats_consumed(p_partner), 0),
      'agentic_allowance', p.agentic_allowance,
      'agentic_consumed',  app.partner_agentic_seats_consumed(p_partner),
      'agentic_remaining', greatest(p.agentic_allowance
                                    - app.partner_agentic_seats_consumed(p_partner), 0),
      'status',      p.status,
      'staff_limit', p.staff_limit,
      'redemptions', (select count(*) from public.code_redemptions r
                        join public.access_codes c on c.id = r.code_id
                       where c.partner_id = p_partner))
  else null end
  from public.partners p where p.id = p_partner;
$$;
revoke all on function public.partner_overview(uuid) from public, anon;
grant execute on function public.partner_overview(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
