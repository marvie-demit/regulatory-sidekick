-- ============================================================================
-- 0022_startup_programme.sql — the Startup Programme application.
--
-- Replaces a SELF-DECLARED discount with a REVIEWED one. Until now the €1,800
-- price was gated by a checkbox: ELIGIBILITY_STATEMENT, ticked at checkout and
-- stored verbatim on the purchase row (0014). That was a deliberate choice —
-- BUSINESS-MODEL.md §6 argues a structural gate beats adjudicating every deal —
-- but it is thin evidence for 70% off, and it tells us nothing about who bought.
--
-- The programme exists for one kind of company: a very small, early startup that
-- genuinely cannot fund CE marking. So the form only has to answer four
-- questions — are they real, are they small, are they under-funded, and are they
-- actually building a device. Everything past that is due diligence that costs
-- the applicant time and the reviewer attention without changing the decision,
-- which is why there are twelve columns here and not forty.
--
-- THE PROPERTY THIS MIGRATION TURNS ON: a workspace can never approve itself.
-- There is no RLS policy anywhere below that lets an org write status =
-- 'approved'. The only path is decide_startup_application(), which re-checks
-- authorisation inside the function. An app-layer gate bug therefore cannot
-- produce an approved application, and lib/billing/actions.ts can treat
-- "approved row exists" as sufficient without also trusting the UI.
--
-- WHY PARTNER DECISIONS ARE AN RPC AND PLATFORM DECISIONS ARE NOT: exactly the
-- reasoning in 0016. Platform admins are an env allowlist — a handful of people,
-- so a service-role server action is proportionate. Partner admins are rows in
-- partner_members and there will be many, so a service-role path triggered by a
-- partner admin would turn any gate bug into full database access.
--
-- Requires 0014 (purchases) and 0015 (partners). Additive; both are already
-- applied in production. Idempotent; safe to re-run.
-- ============================================================================
begin;

create table if not exists public.startup_applications (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,

  -- Which partner, if any, this was submitted through. Captured SERVER-SIDE from
  -- the request host (lib/partners/brand.ts getRequestPartnerSlug), never from a
  -- form field — a partner_id the applicant can choose would let anyone post
  -- their funding position into an arbitrary investor's review queue.
  -- ON DELETE SET NULL, not CASCADE: deleting a partner must not delete a
  -- customer's application, which is evidence behind a discount they hold.
  partner_id    uuid references public.partners(id) on delete set null,

  status        text not null default 'draft'
                check (status in ('draft','submitted','approved','declined','withdrawn')),

  -- ---- are they real? ----
  legal_name       text,
  website          text,
  country          text,
  founded_on       date,

  -- ---- are they small? ----
  employees        int check (employees is null or employees between 0 and 10000),

  -- ---- are they actually building a device? ----
  device_summary   text check (device_summary is null or length(device_summary) <= 200),
  regulation       text check (regulation is null or regulation in ('MDR','IVDR','unsure')),
  risk_class       text check (risk_class is null or length(risk_class) <= 20),

  -- ---- are they under-funded? ----
  -- Minor units (cents), consistent with purchases.amount_total. Storing euros
  -- here and cents there is the kind of inconsistency that produces a 100x
  -- reporting error nobody notices until it is in a board deck.
  funding_dilutive_eur     bigint check (funding_dilutive_eur     is null or funding_dilutive_eur     >= 0),
  funding_non_dilutive_eur bigint check (funding_non_dilutive_eur is null or funding_non_dilutive_eur >= 0),
  revenue_12m_eur          bigint check (revenue_12m_eur          is null or revenue_12m_eur          >= 0),

  -- The only question a reviewer really weighs. Everything above either
  -- corroborates this answer or contradicts it.
  why_blocked      text check (why_blocked is null or length(why_blocked) <= 400),

  -- Stored verbatim rather than as a boolean alone, for the same reason
  -- purchases.eligibility_statement is: the declaration stays readable as
  -- evidence even after the wording is revised.
  declared         boolean not null default false,
  declaration_text text,

  reviewed_by   uuid references auth.users(id),
  reviewed_at   timestamptz,
  decision_note text,
  submitted_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- One LIVE application per workspace. Partial rather than a plain unique
-- constraint: a declined applicant must be able to apply again without us
-- deleting the record of the first decision.
create unique index if not exists startup_applications_live_idx
  on public.startup_applications (org_id)
  where status in ('draft','submitted','approved');

-- Review queues read by status; partner queues read by partner.
create index if not exists startup_applications_status_idx
  on public.startup_applications (status, submitted_at desc);
create index if not exists startup_applications_partner_idx
  on public.startup_applications (partner_id, submitted_at desc)
  where partner_id is not null;

-- The link from a purchase back to the application that justified its price.
-- This is what purchases.eligibility_statement used to be, only reviewed.
alter table public.purchases
  add column if not exists startup_application_id uuid
  references public.startup_applications(id) on delete set null;

-- The tier is renamed practitioner -> startup, so the CHECK from 0020 has to
-- admit the new value or every Startup Programme purchase is rejected at the
-- INSERT — after the customer has already paid.
--
-- 'practitioner' STAYS legal. There are already purchase rows carrying it, and
-- rewriting a historical row to a tier that did not exist when it was bought
-- would falsify the record that justifies its price. A legacy value costs
-- nothing; a rewritten one costs the audit trail.
alter table public.purchases drop constraint if exists purchases_tier_chk;
alter table public.purchases
  add constraint purchases_tier_chk
  check (tier in ('practitioner', 'startup', 'standard', 'agent'));

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.startup_applications enable row level security;

-- Any member may read their own workspace's application. Deliberately not
-- admin-only: a member who cannot see the application cannot tell whether the
-- workspace is waiting on a decision, and would ask an admin who is equally in
-- the dark.
drop policy if exists sa_select on public.startup_applications;
create policy sa_select on public.startup_applications
  for select using ((select app.is_member(org_id)));

-- Only workspace admins create one, and only in a state the org is allowed to
-- author. `status` is constrained in WITH CHECK so an INSERT cannot arrive
-- pre-approved.
drop policy if exists sa_insert on public.startup_applications;
create policy sa_insert on public.startup_applications
  for insert with check (
    (select app.has_role(org_id, 'admin')) and status in ('draft','submitted')
  );

-- Editable while the org still owns it. USING restricts which rows may be
-- touched (never a decided one); WITH CHECK restricts what they may become —
-- without the second clause an admin could UPDATE a draft straight to
-- 'approved' and grant themselves a 70% discount.
drop policy if exists sa_update on public.startup_applications;
create policy sa_update on public.startup_applications
  for update
  using (
    (select app.has_role(org_id, 'admin')) and status in ('draft','submitted')
  )
  with check (
    (select app.has_role(org_id, 'admin')) and status in ('draft','submitted','withdrawn')
  );

-- No delete policy. A withdrawn application is set to 'withdrawn', not removed:
-- purchases.startup_application_id points here, and an applicant deleting the
-- evidence behind a discount they already used is exactly what must not happen.

-- ---------------------------------------------------------------------------
-- Decision RPC — the only path to 'approved' or 'declined'.
-- ---------------------------------------------------------------------------
create or replace function public.decide_startup_application(
  p_app uuid, p_decision text, p_note text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_app public.startup_applications;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if p_decision not in ('approved','declined') then
    raise exception 'decision must be approved or declined';
  end if;

  select * into v_app from public.startup_applications where id = p_app;
  if not found then raise exception 'unknown application'; end if;

  -- Partner admins only, and only for their OWN applications. Platform admins
  -- do not come through here — they hold the service role, which bypasses RLS
  -- and this function alike (see the header).
  if v_app.partner_id is null then
    raise exception 'this application was not submitted through a partner';
  end if;
  if not (select app.has_partner_role(v_app.partner_id, 'admin')) then
    raise exception 'must be an admin of this partner';
  end if;

  -- Only a submitted application can be decided. Re-deciding an approved one
  -- would silently revoke a discount the workspace may already have spent.
  if v_app.status <> 'submitted' then
    raise exception 'only a submitted application can be decided';
  end if;

  update public.startup_applications
     set status        = p_decision,
         reviewed_by   = v_uid,
         reviewed_at   = now(),
         decision_note = p_note,
         updated_at    = now()
   where id = p_app;

  -- Both trails: the workspace's own audit log, and the partner's.
  insert into public.audit_log(org_id, actor_id, action, entity_type, entity_id, detail)
    values (v_app.org_id, v_uid, 'startup_application.' || p_decision,
            'startup_application', p_app::text,
            jsonb_build_object('partner_id', v_app.partner_id, 'note', p_note));
  insert into public.partner_audit(partner_id, actor_id, action, entity_type, entity_id, detail)
    values (v_app.partner_id, v_uid, 'startup_application.' || p_decision,
            'startup_application', p_app::text,
            jsonb_build_object('org_id', v_app.org_id));

  return jsonb_build_object('status', p_decision);
end; $$;
revoke all on function public.decide_startup_application(uuid, text, text) from public, anon;
grant execute on function public.decide_startup_application(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Partner read.
--
-- THIS DELIBERATELY WIDENS THE 0015 PRIVACY BOUNDARY, and is the one thing in
-- this migration worth arguing about.
--
-- partner_portfolio() exists so that "a partner may learn WHICH workspace
-- redeemed its code and WHEN — nothing else, ever". This function hands a
-- partner an applicant's headcount, funding position, revenue and their account
-- of why CE marking is out of reach. That is a real widening, and it is why this
-- is a SEPARATE function rather than extra columns on partner_portfolio: the
-- narrow projection stays narrow for every other use, and a reviewer of any
-- future change sees these two side by side and has to think about which one
-- they are touching.
--
-- What makes it acceptable: the applicant CHOSE this partner by applying through
-- their subdomain, and the form names the partner and says they will read it. It
-- is scoped to that partner's own applications and to submitted-or-later ones —
-- a partner never sees a draft somebody is still writing.
-- ---------------------------------------------------------------------------
create or replace function public.partner_startup_applications(p_partner uuid)
  returns table (
    id uuid, workspace_name text, status text, submitted_at timestamptz,
    legal_name text, website text, country text, founded_on date, employees int,
    device_summary text, regulation text, risk_class text,
    funding_dilutive_eur bigint, funding_non_dilutive_eur bigint,
    revenue_12m_eur bigint, why_blocked text,
    declared boolean, decision_note text, reviewed_at timestamptz
  )
  language sql stable security definer set search_path = '' as $$
  select a.id, o.name, a.status, a.submitted_at,
         a.legal_name, a.website, a.country, a.founded_on, a.employees,
         a.device_summary, a.regulation, a.risk_class,
         a.funding_dilutive_eur, a.funding_non_dilutive_eur,
         a.revenue_12m_eur, a.why_blocked,
         a.declared, a.decision_note, a.reviewed_at
  from public.startup_applications a
  join public.organizations o on o.id = a.org_id
  where a.partner_id = p_partner
    and a.status <> 'draft'
    and (select app.is_partner_member(p_partner))
  order by a.submitted_at desc nulls last
  limit 500;
$$;
revoke all on function public.partner_startup_applications(uuid) from public, anon;
grant execute on function public.partner_startup_applications(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
