-- ============================================================================
-- 0014_billing.sql — Stripe checkout bookkeeping.
--
-- Access itself is UNCHANGED: a purchase still grants access by setting
-- organizations.plan / plan_expires_at, exactly like redeem_access_code (0004)
-- and the platform-admin console. Stripe is just another way to trip the same
-- switch, so nothing here touches the gating model.
--
-- Three additions:
--   organizations.stripe_customer_id  — reuse one Customer per workspace, so a
--                                       second purchase lands on the same
--                                       customer record (and the same tax IDs).
--   purchases                         — the commercial record: what was bought,
--                                       for how much, under which eligibility
--                                       declaration. This is the evidence trail
--                                       for the Practitioner price gate.
--   stripe_events                     — webhook idempotency. Stripe retries and
--                                       can deliver the same event twice; the
--                                       primary key makes a replay a no-op.
--
-- SECURITY: 0007 revoked table-level UPDATE on organizations and re-granted only
-- specific columns (name, slug + the 0012 profile columns). stripe_customer_id
-- is therefore unwritable by `authenticated` by construction — the webhook
-- (service role) is the only writer. Same reasoning as plan / agentic_enabled.
-- Idempotent; safe to re-run.
-- ============================================================================
begin;

alter table public.organizations
  add column if not exists stripe_customer_id text;

-- One workspace per Stripe customer. Partial so the many NULLs don't collide.
create unique index if not exists organizations_stripe_customer_id_idx
  on public.organizations (stripe_customer_id)
  where stripe_customer_id is not null;

create table if not exists public.purchases (
  id                       uuid primary key default gen_random_uuid(),
  org_id                   uuid not null references public.organizations(id) on delete cascade,

  -- What was bought. `tier` is the price point; `plan` is the access it grants.
  tier                     text not null check (tier in ('practitioner', 'standard')),
  plan                     text not null check (plan in ('full', 'enterprise')),
  payment_option           text not null check (payment_option in ('once', 'x3', 'x6')),
  -- Stripe Checkout mode: one-time payment, or a capped instalment subscription.
  mode                     text not null check (mode in ('payment', 'subscription')),

  --   pending   session created, customer hasn't paid (or abandoned checkout)
  --   paid      one-time purchase settled
  --   active    instalment plan in good standing
  --   past_due  an instalment failed; access is NOT revoked (see the webhook)
  --   completed all instalments collected
  --   cancelled subscription ended before the last instalment
  status                   text not null default 'pending'
                           check (status in ('pending','paid','active','past_due','completed','cancelled')),

  stripe_session_id        text unique,
  stripe_customer_id       text,
  stripe_payment_intent_id text,
  stripe_subscription_id   text,

  amount_total             bigint,        -- minor units, tax inclusive, as Stripe reports it
  currency                 text,
  email                    text,

  installments_total       int,           -- null for one-time
  installments_paid        int not null default 0,

  -- The §6 structural gate: Practitioner pricing is self-declared at checkout.
  -- Storing the exact wording (not just a boolean) means the declaration stays
  -- readable as evidence even after the pricing copy is reworded.
  eligibility_declared     boolean not null default false,
  eligibility_statement    text,

  granted_at               timestamptz,   -- when access was actually switched on
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists purchases_org_created_idx
  on public.purchases (org_id, created_at desc);
create index if not exists purchases_subscription_idx
  on public.purchases (stripe_subscription_id)
  where stripe_subscription_id is not null;

create table if not exists public.stripe_events (
  id          text primary key,            -- Stripe's evt_… id
  type        text not null,
  received_at timestamptz not null default now()
);

alter table public.purchases     enable row level security;
alter table public.stripe_events enable row level security;

-- purchases: a member may read their own workspace's receipts. Deliberately no
-- insert/update/delete policy — every write is a service-role write from the
-- checkout action or the webhook, so a workspace can never invent a purchase.
drop policy if exists pu_select on public.purchases;
create policy pu_select on public.purchases
  for select using ((select app.is_member(org_id)));

-- stripe_events: no policy at all -> service role only. Nothing in the app UI
-- reads it; it exists purely so a redelivered webhook is a no-op.

notify pgrst, 'reload schema';
commit;
