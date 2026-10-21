-- ============================================================================
-- 0024_readiness_leads.sql — the free readiness self-assessment (rung 1).
--
-- BUSINESS-MODEL.md §3 puts a free, email-gated MDR/13485 readiness assessment
-- between "browse the roadmap" (free) and "buy full access" (€1,800+), and §6.7
-- names it a hard prerequisite for the fund and accelerator motion. §6.3's cold
-- email offers to "run our readiness assessment on a company you're diligencing
-- right now", so the output has to be a thing you can send someone — which is
-- what `token` is for.
--
-- ONE ROW PER COMPLETED ASSESSMENT. Both the answers and the computed result are
-- frozen into the row rather than recomputed on read. The score is a function of
-- the corpus, and the corpus changes: re-scoring an eight-month-old assessment
-- against today's activity set would silently rewrite a number somebody already
-- forwarded to an investor. `content_hash` and `scorer_version` record what it
-- was scored against, so a drift is visible instead of invisible.
--
-- WHO CAN READ WHAT — the two decisions worth arguing about:
--
-- 1. The table has RLS ON and NO POLICIES AT ALL. That is not an oversight. It
--    means neither `anon` nor `authenticated` can select, insert, update or
--    delete a single row, and the only reader is the service role — which, per
--    lib/auth/platform.ts, is exactly "platform admins": an env-var allowlist of
--    operators, never a database role anyone can be promoted into. A lead list
--    is a pile of other people's email addresses and their candid account of how
--    unready they are; no customer workspace has any business reading it, so no
--    customer workspace gets a policy.
--
-- 2. The public result page does NOT use the service role. It calls
--    readiness_result_by_token(), a security-definer function that takes an
--    unguessable token and returns the score and nothing else — no email, no
--    consent flag, no answers blob. So the worst a guessed or leaked token can
--    ever yield is one company's readiness score, never the lead list. Putting a
--    service-role client on an unauthenticated route would have made the blast
--    radius of any bug on that page the whole table instead.
--
-- The INSERT is a service-role write from a server action (lib/readiness/store.ts),
-- the same shape as the partner lookups in lib/startup/actions.ts. There is
-- deliberately no anon insert policy: an anon-writable table on a public route
-- is an open-ended write primitive, and routing the write through the server
-- action keeps validation and scoring on one side of the boundary.
--
-- Requires 0015 (partners) for the partner_id reference. Additive and
-- idempotent; safe to re-run.
-- ============================================================================
begin;

create table if not exists public.readiness_leads (
  id            uuid primary key default gen_random_uuid(),

  -- The shareable result URL is /readiness/r/<token>. Minted server-side from
  -- 32 random bytes, base64url. UNIQUE because the URL is the identity of the
  -- artefact; a collision would hand one company another company's score.
  token         text not null unique check (length(token) between 20 and 128),

  -- The point of the whole rung. Lower-cased and trimmed before insert so the
  -- same person doesn't appear three times.
  email         text not null check (position('@' in email) > 1 and length(email) <= 320),

  -- Optional, and asked for because the artefact reads better with a name on it
  -- than without one. Never required: a gate that demands a company name is a
  -- gate more people abandon.
  org_name      text check (org_name is null or length(org_name) <= 160),
  role          text check (role is null or length(role) <= 80),

  -- Which partner's subdomain this came in through, resolved SERVER-SIDE from
  -- the request host exactly as in 0022 — never from a form field. An
  -- accelerator running the assessment across its cohort is the §6.7 motion, so
  -- knowing which cohort a lead came from is the whole value of the column.
  -- SET NULL rather than CASCADE: deleting a partner must not delete leads.
  partner_id    uuid references public.partners(id) on delete set null,

  -- The questionnaire as answered, and the scored output as rendered. `result`
  -- is what the public page serves, so it must contain nothing personal beyond
  -- the org name the respondent chose to put on it.
  answers       jsonb not null,
  result        jsonb not null,

  -- Denormalised out of `result` for the admin list and for cohort reporting:
  -- "day-0 and day-60 readiness scores" (§6.4 stage 2) is a query over these
  -- columns, and it should not have to unpack jsonb to run.
  overall       int  not null check (overall between 0 and 100),
  band          text not null check (length(band) <= 40),
  route         text check (route is null or route in ('MDR','IVDR','undecided','FDA')),
  risk_class    text check (risk_class is null or length(risk_class) <= 20),

  -- What it was scored against. See the header.
  content_hash   text check (content_hash is null or length(content_hash) <= 64),
  scorer_version text not null check (length(scorer_version) <= 20),

  -- Delivering the result the respondent asked for is Art. 6(1)(b) GDPR and
  -- needs no consent. Sending them the quarterly regulatory changelog later is
  -- a different purpose and does. So the flag defaults to FALSE and the wording
  -- is stored verbatim alongside it — the same reasoning as
  -- purchases.eligibility_statement and startup_applications.declaration_text:
  -- the consent stays readable as evidence after the copy is revised.
  marketing_consent boolean not null default false,
  consent_text      text,

  created_at    timestamptz not null default now()
);

-- The admin list reads newest-first; the lead list is the product of this table.
create index if not exists readiness_leads_created_idx
  on public.readiness_leads (created_at desc);

-- "Has this person been here before, and has their score moved?" — the §6.4
-- stage-2 question, and also what the server action checks to collapse a
-- double-submit instead of minting a second row.
create index if not exists readiness_leads_email_idx
  on public.readiness_leads (lower(email), created_at desc);

-- A partner's cohort view.
create index if not exists readiness_leads_partner_idx
  on public.readiness_leads (partner_id, created_at desc)
  where partner_id is not null;

-- ---------------------------------------------------------------------------
-- RLS — on, and deliberately empty. See decision 1 in the header.
-- ---------------------------------------------------------------------------
alter table public.readiness_leads enable row level security;

-- Belt and braces. RLS already denies everything without a policy, but these
-- revokes mean a future `create policy` on this table cannot accidentally open
-- it to a role that was never supposed to hold the grant in the first place.
revoke all on table public.readiness_leads from anon, authenticated;

-- ---------------------------------------------------------------------------
-- The public result read — the ONLY way anything reaches an unauthenticated
-- caller, and it returns no personal data beyond the name on the artefact.
--
-- Note what is NOT in the return type: email, marketing_consent, consent_text,
-- answers, partner_id. A result is meant to be forwarded; a lead is not.
-- ---------------------------------------------------------------------------
create or replace function public.readiness_result_by_token(p_token text)
  returns table (result jsonb, org_name text, created_at timestamptz)
  language sql stable security definer set search_path = '' as $$
  select l.result, l.org_name, l.created_at
  from public.readiness_leads l
  where l.token = p_token
    -- Refuse to look up anything that cannot be a real token. Without this a
    -- probe for token = '' is a table scan on every attempt.
    and length(p_token) between 20 and 128
  limit 1;
$$;
revoke all on function public.readiness_result_by_token(text) from public;
grant execute on function public.readiness_result_by_token(text) to anon, authenticated;

notify pgrst, 'reload schema';
commit;
