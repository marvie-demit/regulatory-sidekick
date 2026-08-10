-- ============================================================================
-- 0015_partners.sql — accelerators, incubators and investors as a tenant type.
--
-- A PARTNER hands Regulatory Sidekick to its portfolio companies. The platform
-- admin creates the partner and sets a licence allowance; the partner mints
-- access codes against that allowance and invites its own staff.
--
-- Partners are deliberately NOT organizations:
--   app.is_member(org_id) is the read gate on ~15 per-org tables (activity_status,
--   evidence, audit_log, purchases, …) plus the three storage.objects policies.
--   If partner staff lived in `memberships`, one mis-scoped insert would hand an
--   investor their portfolio company's regulatory evidence, and correctness would
--   depend on every one of those policies remembering to exclude partners.
--   With separate tables there is no path in the schema from partner_members to
--   activity_status — "a partner sees only a workspace name and a date" stops
--   being a rule someone enforces and becomes a property of the graph.
--   Partners also have no device profile, no plan and no QMS state.
--
-- The allowance is counted in LICENCES, not codes: one 20-use cohort code costs
-- 20 seats. See app.partner_seats_consumed for the exact formula. Minting goes
-- through partner_mint_codes(), which takes a row lock on the partner so two
-- admins minting at once cannot both read the same total and overshoot.
--
-- Raw codes are generated in TypeScript (randomBytes -> base64url, same as
-- lib/admin/actions.ts) and hashed HERE, so a caller can never store a hash that
-- doesn't match its code. sha256(convert_to(...)) — NOT pgcrypto digest(), which
-- does not resolve under `search_path = ''` (the 0003 bug).
--
-- Apply in the SQL editor BEFORE deploying the matching app code. Idempotent.
-- ============================================================================
begin;

-- ============ partner tenancy ============
create table if not exists partners (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  -- Subdomain key (acme -> acme.regulatory-sidekick.notjustany.tech). Mirrors
  -- organizations.slug, which has been unused since 0001 — here it is
  -- load-bearing. The reserved list must stay in step with RESERVED_SLUGS in
  -- lib/partners/host.ts: a partner claiming `www` or `api` would shadow
  -- infrastructure hostnames.
  slug                text not null unique
                      check (slug ~ '^[a-z0-9][a-z0-9-]{1,30}$'
                             and slug not in ('www','app','api','admin','auth','mail',
                                              'static','assets','cdn','docs','status',
                                              'dev','staging','test','support','help')),
  kind                text not null default 'accelerator'
                      check (kind in ('accelerator','incubator','investor','other')),
  -- Suspend rather than delete: access_codes.partner_id is ON DELETE RESTRICT,
  -- so a partner with issued codes cannot be removed. Suspension blocks minting
  -- AND redemption of their outstanding codes.
  status              text not null default 'active' check (status in ('active','suspended')),

  -- Licences this partner may hand out, in seats. Platform-admin controlled;
  -- see the column revoke below — a partner must never raise their own.
  licence_allowance   int not null default 0 check (licence_allowance between 0 and 100000),
  -- Partner STAFF cap. Unrelated to SEAT_LIMIT (lib/auth/members.ts), which is
  -- the per-workspace human cap on a customer QMS org.
  staff_limit         int not null default 10 check (staff_limit between 1 and 200),

  -- Values the console pre-fills. The mint RPC re-validates everything.
  default_grant_days  int check (default_grant_days  is null or default_grant_days  between 1 and 3650),
  max_grant_days      int check (max_grant_days      is null or max_grant_days      between 1 and 3650),
  default_redeem_days int default 30
                      check (default_redeem_days is null or default_redeem_days between 1 and 365),

  contact_email       text,
  note                text,

  -- White-label branding. Unused until the branding phase. Every colour ends up
  -- in CSS, so the format is constrained HERE as well as in the app — an
  -- unvalidated value would be a stylesheet-injection primitive on every page a
  -- partner's tenants load.
  brand_primary       text check (brand_primary is null or brand_primary ~ '^#[0-9a-fA-F]{6}$'),
  brand_mid           text check (brand_mid     is null or brand_mid     ~ '^#[0-9a-fA-F]{6}$'),
  brand_accent        text check (brand_accent  is null or brand_accent  ~ '^#[0-9a-fA-F]{6}$'),
  brand_surface       text check (brand_surface is null or brand_surface ~ '^#[0-9a-fA-F]{6}$'),
  wordmark            text check (wordmark is null or length(wordmark) <= 40),
  logo_path           text,
  logo_alt            text,

  created_by          uuid references auth.users(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table if not exists partner_members (
  partner_id uuid not null references partners(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null default 'member' check (role in ('admin','member')),
  created_at timestamptz not null default now(),
  primary key (partner_id, user_id)
);
create index if not exists partner_members_user_idx on partner_members(user_id);

-- Mirrors `invitations` (0001) exactly: store the HASH, share the raw token.
create table if not exists partner_invitations (
  id          uuid primary key default gen_random_uuid(),
  partner_id  uuid not null references partners(id) on delete cascade,
  email       text not null,
  role        text not null default 'member' check (role in ('admin','member')),
  token_hash  text unique not null,
  invited_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id)
);
create unique index if not exists partner_invitations_pending_idx
  on partner_invitations(partner_id, lower(email)) where accepted_at is null;

-- Partner-scoped audit trail. NOT audit_log: that table's org_id is `not null
-- references organizations` and its only policy is app.is_member(org_id).
-- Partner events have no org, and dropping the NOT NULL would make those rows
-- invisible to every policy while weakening a clean append-only invariant — and
-- it is the one change here that is awkward to reverse later. A parallel table
-- keeps both trails honest. Customer-side events (plan.redeem) keep writing to
-- audit_log exactly as they do now, and the partner's view of "who redeemed" is
-- partner_portfolio(), not this table.
create table if not exists partner_audit (
  id          bigint generated always as identity primary key,
  partner_id  uuid not null references partners(id) on delete cascade,
  actor_id    uuid references auth.users(id),
  action      text not null,
  entity_type text,
  entity_id   text,
  detail      jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists partner_audit_partner_idx
  on partner_audit(partner_id, created_at desc);

-- ============ code attribution + soft revoke ============
-- ON DELETE RESTRICT, not SET NULL: orphaning a partner's codes would silently
-- drop them out of allowance accounting while leaving them redeemable.
alter table access_codes
  add column if not exists partner_id uuid references partners(id) on delete restrict,
  add column if not exists batch_id   uuid,
  add column if not exists revoked_at timestamptz,
  add column if not exists revoked_by uuid references auth.users(id);

create index if not exists access_codes_partner_idx
  on access_codes(partner_id, created_at desc) where partner_id is not null;
create index if not exists access_codes_batch_idx
  on access_codes(batch_id) where batch_id is not null;

-- ============ RLS helpers ============
-- Same contract as app.is_member / app.has_role (0001): SECURITY DEFINER so
-- policies calling them don't recurse, in the non-exposed `app` schema, pinned
-- with search_path = ''.
create or replace function app.is_partner_member(p_partner uuid) returns boolean
  language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.partner_members m
    where m.partner_id = p_partner and m.user_id = (select auth.uid()));
$$;

create or replace function app.has_partner_role(p_partner uuid, p_role text) returns boolean
  language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.partner_members m
    where m.partner_id = p_partner and m.user_id = (select auth.uid()) and m.role = p_role);
$$;

-- THE allowance formula, in one place:
--   live code            -> max_uses    (the whole reservation is held)
--   revoked code         -> used_count  (only what was actually spent)
--   redeem-by lapsed     -> used_count  (same as revoked)
-- Unredeemed seats coming back on expiry is deliberate: a 30-day cohort with
-- three no-shows should not burn three seats forever. It also makes expiry and
-- revocation behave identically, which is one fewer rule to explain.
-- Lives in `app` (not exposed via PostgREST) so it can be called from definer
-- functions without letting any authenticated user count any partner's seats.
create or replace function app.partner_seats_consumed(p_partner uuid) returns int
  language sql stable security definer set search_path = '' as $$
  select coalesce(sum(case
    when c.revoked_at is not null                          then c.used_count
    when c.expires_at is not null and c.expires_at < now() then c.used_count
    else c.max_uses
  end), 0)::int
  from public.access_codes c
  where c.partner_id = p_partner;
$$;

revoke all on function app.is_partner_member(uuid)          from public, anon;
revoke all on function app.has_partner_role(uuid, text)     from public, anon;
revoke all on function app.partner_seats_consumed(uuid)     from public, anon;
grant execute on function app.is_partner_member(uuid)        to authenticated;
grant execute on function app.has_partner_role(uuid, text)   to authenticated;
grant execute on function app.partner_seats_consumed(uuid)   to authenticated;

-- ============ RLS ============
alter table partners            enable row level security;
alter table partner_members     enable row level security;
alter table partner_invitations enable row level security;
alter table partner_audit       enable row level security;

drop policy if exists pt_select   on partners;
drop policy if exists ptm_select  on partner_members;
drop policy if exists ptinv_admin on partner_invitations;
drop policy if exists pta_select  on partner_audit;

-- Read-only for staff. Every write is service role (platform admin) or one of
-- the definer RPCs below. Same shape as access_codes / purchases.
create policy pt_select on partners for select
  using ((select app.is_partner_member(id)));

-- user_id = auth.uid() is the non-recursive base case; the is_partner_member
-- disjunct (definer, so it doesn't re-enter this policy) lets staff see
-- co-workers. Same shape as mem_select in 0001.
create policy ptm_select on partner_members for select
  using (user_id = (select auth.uid()) or (select app.is_partner_member(partner_id)));

-- Admin-only, and acceptance happens through the RPC before membership exists.
create policy ptinv_admin on partner_invitations for all
  using ((select app.has_partner_role(partner_id, 'admin')))
  with check ((select app.has_partner_role(partner_id, 'admin')));

create policy pta_select on partner_audit for select
  using ((select app.is_partner_member(partner_id)));

-- access_codes gains its FIRST policy: partner staff read their own codes, so
-- the partner console can use the user's client and RLS stays the boundary even
-- if a TypeScript filter is ever dropped. Platform codes (partner_id null)
-- remain invisible to everyone but the service role, exactly as today.
drop policy if exists ac_partner_select on access_codes;
create policy ac_partner_select on access_codes for select
  using (partner_id is not null and (select app.is_partner_member(partner_id)));

-- ============ column grants ============
-- The 0007_lock_plan_columns lesson: a SELECT policy plus Supabase's default
-- table grants is not enough. A partner who can PATCH licence_allowance,
-- staff_limit or status has no allowance at all.
revoke all on public.partners        from anon;
revoke insert, update, delete on public.partners        from authenticated;
revoke all on public.partner_members from anon;
revoke insert, update, delete on public.partner_members from authenticated;
revoke all on public.partner_audit   from anon;
revoke insert, update, delete on public.partner_audit   from authenticated;
-- Codes were already unwritable by policy (RLS with no write policy); make it
-- explicit at the grant layer too.
revoke insert, update, delete on public.access_codes from authenticated, anon;
-- partner_invitations keeps its default grants: ptinv_admin is the gate, exactly
-- as inv_admin is for org invites (lib/auth/team.ts inserts with the user client).

-- ============================================================================
-- Minting: the allowance gate.
-- p_codes is the raw codes generated app-side; hashing happens here.
-- ============================================================================
create or replace function public.partner_mint_codes(
  p_partner     uuid,
  p_codes       text[],
  p_max_uses    int,
  p_grant_days  int,
  p_redeem_days int,
  p_note        text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid      uuid := (select auth.uid());
  v_p        public.partners;
  v_n        int  := coalesce(array_length(p_codes, 1), 0);
  v_consumed int;
  v_seats    int;
  v_batch    uuid := gen_random_uuid();
  v_grant    int;
  v_exp      timestamptz;
  v_raw      text;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  -- Re-checked HERE, not only in the server action: a definer function is a
  -- privilege boundary and must not trust its caller.
  if not (select app.has_partner_role(p_partner, 'admin')) then
    raise exception 'must be an admin of this partner';
  end if;
  if v_n < 1 or v_n > 200 then raise exception 'mint between 1 and 200 codes at a time'; end if;
  if p_max_uses is null or p_max_uses < 1 or p_max_uses > 500 then
    raise exception 'seats per code must be between 1 and 500';
  end if;
  if p_grant_days is not null and (p_grant_days < 1 or p_grant_days > 3650) then
    raise exception 'access days must be between 1 and 3650';
  end if;
  if p_redeem_days is not null and (p_redeem_days < 1 or p_redeem_days > 365) then
    raise exception 'redeem-by must be between 1 and 365 days';
  end if;

  -- SERIALIZATION POINT. Concurrent mints for the SAME partner queue here;
  -- different partners never contend. Everything below reads a consistent world.
  select * into v_p from public.partners where id = p_partner for update;
  if not found then raise exception 'unknown partner'; end if;
  if v_p.status <> 'active' then raise exception 'this partner account is suspended'; end if;

  v_consumed := app.partner_seats_consumed(p_partner);
  v_seats    := v_n * p_max_uses;
  if v_consumed + v_seats > v_p.licence_allowance then
    raise exception 'not enough licences: % of % remaining, this mint needs %',
      greatest(v_p.licence_allowance - v_consumed, 0), v_p.licence_allowance, v_seats;
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
       created_by, partner_id, batch_id, target_org_id)
    values
      (encode(sha256(convert_to(v_raw, 'UTF8')), 'hex'), v_raw,
       -- HARD-CODED. Enterprise is a custom bundled deal granted out of band by
       -- the platform admin (lib/billing/grant.ts) — never by a partner.
       'full',
       v_grant, p_max_uses, v_exp, p_note,
       v_uid, p_partner, v_batch,
       null);   -- partner codes are never org-locked
  end loop;

  insert into public.partner_audit(partner_id, actor_id, action, entity_type, entity_id, detail)
    values (p_partner, v_uid, 'codes.mint', 'code_batch', v_batch::text,
            jsonb_build_object('count', v_n, 'max_uses', p_max_uses, 'seats', v_seats,
                               'grant_days', v_grant, 'expires_at', v_exp));

  return jsonb_build_object('batch_id', v_batch, 'count', v_n, 'seats', v_seats,
                            'expires_at', v_exp,
                            'remaining', v_p.licence_allowance - v_consumed - v_seats);
end; $$;
revoke all on function public.partner_mint_codes(uuid, text[], int, int, int, text) from public, anon;
grant execute on function public.partner_mint_codes(uuid, text[], int, int, int, text) to authenticated;

-- ============================================================================
-- Revoking returns the unredeemed remainder to the allowance.
-- SOFT revoke, deliberately: code_redemptions.code_id is ON DELETE CASCADE
-- (0004:29), so deleting a redeemed code would erase the record that a workspace
-- was ever granted a plan while the workspace keeps the plan.
-- ============================================================================
create or replace function public.partner_revoke_code(p_code uuid)
  returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid   uuid := (select auth.uid());
  v_c     public.access_codes;
  v_freed int;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select * into v_c from public.access_codes where id = p_code;
  if not found or v_c.partner_id is null then raise exception 'unknown code'; end if;
  if not (select app.has_partner_role(v_c.partner_id, 'admin')) then
    raise exception 'must be an admin of this partner';
  end if;
  if v_c.revoked_at is not null then return jsonb_build_object('freed', 0); end if;

  v_freed := greatest(v_c.max_uses - v_c.used_count, 0);
  update public.access_codes set revoked_at = now(), revoked_by = v_uid where id = p_code;

  insert into public.partner_audit(partner_id, actor_id, action, entity_type, entity_id, detail)
    values (v_c.partner_id, v_uid, 'codes.revoke', 'access_code', p_code::text,
            jsonb_build_object('freed', v_freed, 'used_count', v_c.used_count));

  return jsonb_build_object('freed', v_freed);
end; $$;
revoke all on function public.partner_revoke_code(uuid) from public, anon;
grant execute on function public.partner_revoke_code(uuid) to authenticated;

-- ============================================================================
-- Redemption. Supersedes the 0006 version. Two additions only:
--   * a revoked code is refused
--   * a suspended partner's codes are refused
-- Everything else — the org-admin check, hash, target_org_id, expires_at,
-- used_count, duplicate-redemption guard, audit row — is unchanged.
-- ============================================================================
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

-- ============================================================================
-- The privacy boundary, enforced in the database.
-- A partner may learn WHICH workspace redeemed its code and WHEN — nothing else,
-- ever. An explicit three-column projection, not a view over organizations: a
-- developer widening a TypeScript .select() is a one-line accident, widening
-- this is a migration someone reviews.
-- ============================================================================
create or replace function public.partner_portfolio(p_partner uuid)
  returns table (workspace_name text, redeemed_at timestamptz, code_note text)
  language sql stable security definer set search_path = '' as $$
  select o.name, r.redeemed_at, c.note
  from public.code_redemptions r
  join public.access_codes  c on c.id = r.code_id
  join public.organizations o on o.id = r.org_id
  where c.partner_id = p_partner
    and (select app.is_partner_member(p_partner))
  order by r.redeemed_at desc
  limit 500;
$$;
revoke all on function public.partner_portfolio(uuid) from public, anon;
grant execute on function public.partner_portfolio(uuid) to authenticated;

create or replace function public.partner_overview(p_partner uuid) returns jsonb
  language sql stable security definer set search_path = '' as $$
  select case when (select app.is_partner_member(p_partner)) then
    jsonb_build_object(
      'allowance',   p.licence_allowance,
      'consumed',    app.partner_seats_consumed(p_partner),
      'remaining',   greatest(p.licence_allowance - app.partner_seats_consumed(p_partner), 0),
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

-- ============================================================================
-- Staff invite acceptance. Mirrors accept_invitation (0003), plus the staff cap
-- re-checked at ACCEPTANCE: an invite issued while a seat was free must not push
-- the partner over the cap months later.
-- ============================================================================
create or replace function public.accept_partner_invitation(p_raw_token text)
  returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_inv   public.partner_invitations;
  v_uid   uuid := (select auth.uid());
  v_hash  text;
  v_staff int;
  v_limit int;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  v_hash := encode(sha256(convert_to(p_raw_token, 'UTF8')), 'hex');

  select * into v_inv from public.partner_invitations
    where token_hash = v_hash and accepted_at is null and expires_at > now();
  if not found then raise exception 'invalid or expired invitation'; end if;

  select staff_limit into v_limit from public.partners where id = v_inv.partner_id for update;
  select count(*) into v_staff from public.partner_members where partner_id = v_inv.partner_id;
  if v_staff >= v_limit
     and not exists (select 1 from public.partner_members
                     where partner_id = v_inv.partner_id and user_id = v_uid) then
    raise exception 'this partner has no staff seats left';
  end if;

  insert into public.partner_members(partner_id, user_id, role)
    values (v_inv.partner_id, v_uid, v_inv.role)
    on conflict (partner_id, user_id) do nothing;
  update public.partner_invitations
    set accepted_at = now(), accepted_by = v_uid where id = v_inv.id;
  insert into public.partner_audit(partner_id, actor_id, action, entity_type, entity_id)
    values (v_inv.partner_id, v_uid, 'staff.accept', 'partner_invitation', v_inv.id::text);

  return v_inv.partner_id;
end; $$;
revoke all on function public.accept_partner_invitation(text) from public, anon;
grant execute on function public.accept_partner_invitation(text) to authenticated;

notify pgrst, 'reload schema';
commit;
