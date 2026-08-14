-- ============================================================================
-- 0020_agent_subscription.sql — the agent add-on as a monthly subscription.
--
-- Until now `purchases` described one thing: buying a LICENCE, perpetual, paid
-- once or in 3–6 capped instalments. The agent add-on is a different animal —
-- genuinely recurring, and it grants an ENTITLEMENT rather than a plan. The
-- table is close enough to reuse, but three of its constraints assume a licence
-- and would reject an add-on row outright.
--
-- The property this whole slice turns on: buying the add-on must grant the
-- entitlement and NOT the licence. `plan` becoming nullable is what makes that
-- structurally true rather than a promise in a code comment — an agent purchase
-- has no plan to grant, so there is no value for a webhook bug to write.
--
-- How the entitlement expires, which is the part worth understanding:
--
--   agentic_expires_at is set from the STRIPE PERIOD END every time an invoice
--   is paid. Nothing else moves it. That single rule gives three behaviours for
--   free, with no code to get wrong:
--
--     · a paid month rolls the date forward
--     · a FAILED payment does not extend it — the date simply arrives
--     · a CANCELLATION runs to period end — the date is already correct
--
--   Compare the alternative, where cancelling clears a boolean: that revokes
--   access mid-period the customer has paid for, and every one of those three
--   cases needs its own branch and its own bug.
--
-- Idempotent; safe to re-run.
-- ============================================================================
begin;

-- What kind of thing was bought. Existing rows are all licences.
alter table public.purchases
  add column if not exists kind text not null default 'licence';

alter table public.purchases drop constraint if exists purchases_kind_chk;
alter table public.purchases
  add constraint purchases_kind_chk check (kind in ('licence', 'agent'));

-- `plan` is what a LICENCE grants. An add-on grants none, so it must be
-- nullable — and a licence must still always carry one.
alter table public.purchases alter column plan drop not null;

alter table public.purchases drop constraint if exists purchases_plan_check;
alter table public.purchases drop constraint if exists purchases_plan_chk;
-- `plan is not null` is NOT redundant with the IN test. A CHECK rejects only an
-- explicit FALSE, and for plan = NULL the IN evaluates to NULL, so the licence
-- branch became NULL OR FALSE = NULL — and passed. The first version of this
-- constraint enforced nothing in that direction: a licence row granting no plan
-- was accepted. Caught by testing all three cases against the live table rather
-- than only the one the slice is about.
alter table public.purchases
  add constraint purchases_plan_chk check (
    (kind = 'licence' and plan is not null and plan in ('full', 'enterprise'))
    or (kind = 'agent' and plan is null)
  );

-- The add-on is its own price point, and its own cadence.
alter table public.purchases drop constraint if exists purchases_tier_check;
alter table public.purchases drop constraint if exists purchases_tier_chk;
alter table public.purchases
  add constraint purchases_tier_chk
  check (tier in ('practitioner', 'standard', 'agent'));

alter table public.purchases drop constraint if exists purchases_payment_option_check;
alter table public.purchases drop constraint if exists purchases_payment_option_chk;
alter table public.purchases
  add constraint purchases_payment_option_chk
  check (payment_option in ('once', 'x3', 'x6', 'monthly'));

-- An instalment plan is capped and then cancelled; the add-on runs until the
-- customer stops it. Distinguishing them matters in the invoice handler, which
-- otherwise cancels the subscription the moment `installments_paid` reaches a
-- total the add-on does not have.
comment on column public.purchases.installments_total is
  'Capped instalment plans only. NULL for a one-time payment AND for the agent subscription, which is open-ended.';

create index if not exists purchases_kind_org_idx
  on public.purchases (org_id, kind, created_at desc);

-- The live subscription, so the app can offer "manage" / "cancel" without
-- searching Stripe, and can tell an already-subscribed workspace apart from a
-- new one before sending them to checkout again.
alter table public.organizations
  add column if not exists agentic_subscription_id text;

create unique index if not exists organizations_agentic_subscription_idx
  on public.organizations (agentic_subscription_id)
  where agentic_subscription_id is not null;

commit;
