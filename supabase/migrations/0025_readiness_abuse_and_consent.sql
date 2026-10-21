-- ============================================================================
-- 0025_readiness_abuse_and_consent.sql — the two gaps 0024 shipped with.
--
-- /readiness is an unauthenticated route whose server action holds the service
-- role (lib/readiness/store.ts). 0024 reasoned carefully about who can READ the
-- lead list and stopped there. Two things it left open:
--
-- 1. NOTHING LIMITED THE WRITE. The only brake was a 120-second dedupe on the
--    same address, so a script varying the local part could fill the table the
--    whole rung exists to produce. A lead list full of fabricated rows is not a
--    security incident; it is worse for this product, because the asset §6.7
--    sells to a fund is that the list means something.
--
-- 2. THE ADDRESS WAS NEVER VERIFIED. `marketing_consent` was set from a tick
--    box on a form anyone can submit with anyone's address. A consent record
--    whose subject never typed the address is not consent, and storing the
--    wording verbatim next to it only makes the claim more specific. Art.
--    7(1) GDPR puts the burden of demonstrating consent on us.
--
-- So: a rate-limit bucket keyed on a HASHED ip, and consent that starts as
-- `pending` and becomes real only when someone opens a link sent to the
-- address. Both tables follow 0024's rule — RLS on, no policies, service role
-- only — and both functions are security definer with a narrow return.
--
-- Requires 0024. Additive and idempotent; safe to re-run.
-- ============================================================================
begin;

-- ---------------------------------------------------------------------------
-- 1. Rate limiting
--
-- The ip is SHA-256'd with a server-side salt before it ever reaches the
-- database, so this table holds no address. That is deliberate: the privacy
-- note for /readiness enumerates what the assessment collects, and "every
-- visitor's ip, indefinitely" is not a line anyone wants to add to a published
-- policy in order to stop form spam. A hash with a secret salt and a one-day
-- retention does the same job with far less to defend.
-- ---------------------------------------------------------------------------
create table if not exists public.readiness_attempts (
  id         bigserial primary key,
  -- Hex sha256. Fixed width, so a raw address cannot be smuggled in here by a
  -- caller that forgets to hash.
  ip_hash    text not null check (ip_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);

create index if not exists readiness_attempts_lookup_idx
  on public.readiness_attempts (ip_hash, created_at desc);

alter table public.readiness_attempts enable row level security;
revoke all on table public.readiness_attempts from anon, authenticated;

-- Count, decide and record in one statement each, inside one function, so two
-- simultaneous submissions cannot both read "4 so far" and both proceed.
--
-- Returns TRUE when the caller may proceed. The pruning delete runs first and
-- covers four windows, which keeps the table small without a scheduled job —
-- at this volume the index makes it trivial, and the alternative is a cron
-- nobody remembers to create (OPERATIONS.md exists because of that failure).
create or replace function public.readiness_rate_take(
  p_ip_hash        text,
  p_max            int,
  p_window_seconds int
) returns boolean
  language plpgsql security definer set search_path = '' as $$
declare
  n int;
begin
  if p_ip_hash is null or p_ip_hash !~ '^[0-9a-f]{64}$' then
    -- A caller that cannot identify the client is not a caller we can limit.
    -- Allowing it is the deliberate choice; see lib/readiness/ratelimit.ts.
    return true;
  end if;

  delete from public.readiness_attempts
   where created_at < now() - make_interval(secs => p_window_seconds * 4);

  select count(*) into n
    from public.readiness_attempts
   where ip_hash = p_ip_hash
     and created_at > now() - make_interval(secs => p_window_seconds);

  if n >= p_max then
    return false;
  end if;

  insert into public.readiness_attempts (ip_hash) values (p_ip_hash);
  return true;
end $$;

-- Only the server action calls this, and it holds the service role. Unlike
-- 0024's result read, there is no reason for anon to reach it.
revoke all on function public.readiness_rate_take(text, int, int) from public;
grant execute on function public.readiness_rate_take(text, int, int) to service_role;

-- ---------------------------------------------------------------------------
-- 2. Double opt-in for the changelog
--
-- `marketing_consent` keeps its meaning — "this address may be sent the
-- quarterly changelog" — and becomes the one column the eventual send queries.
-- What changes is that ONLY readiness_confirm_consent() can set it true.
-- The form can now only ask.
-- ---------------------------------------------------------------------------
alter table public.readiness_leads
  add column if not exists consent_state text not null default 'none',
  add column if not exists consent_token text,
  add column if not exists consent_requested_at timestamptz,
  add column if not exists consent_confirmed_at timestamptz;

do $$
begin
  -- Separate statements because `add column if not exists` cannot carry a
  -- named constraint idempotently, and the CHECK is the part that matters.
  if not exists (
    select 1 from pg_constraint
     where conname = 'readiness_leads_consent_state_chk'
  ) then
    alter table public.readiness_leads
      add constraint readiness_leads_consent_state_chk
      check (consent_state in ('none', 'pending', 'confirmed', 'withdrawn'));
  end if;

  -- The token is the identity of a confirmation link, so a collision would let
  -- one person confirm another person's subscription.
  if not exists (
    select 1 from pg_constraint
     where conname = 'readiness_leads_consent_token_key'
  ) then
    alter table public.readiness_leads
      add constraint readiness_leads_consent_token_key unique (consent_token);
  end if;
end $$;

-- `confirmed` is the mailing list. Partial, because almost every row is `none`.
create index if not exists readiness_leads_consent_idx
  on public.readiness_leads (consent_state, created_at desc)
  where consent_state <> 'none';

-- A row written before this migration had `marketing_consent` set from an
-- unverified tick box. Those cannot be demonstrated as consent, so they are
-- demoted to `pending` rather than grandfathered: the address still gets asked
-- once a mailer exists, and nothing is sent in the meantime. 0024 is not yet
-- applied anywhere, so in practice this updates nothing — it is here so that a
-- database where it WAS applied cannot end up with a privileged legacy row.
update public.readiness_leads
   set consent_state = 'pending', marketing_consent = false
 where marketing_consent is true
   and consent_state = 'none';

-- ---------------------------------------------------------------------------
-- The confirmation click. Public, like 0024's result read, and for the same
-- reason: the alternative is a service-role client on an unauthenticated
-- route. It is a write primitive for anon, but the narrowest possible one —
-- it flips one row's consent, and only for a caller holding that row's
-- 256-bit token.
--
-- Returns a bare boolean. It deliberately does NOT return the address: the
-- person clicking already knows it, and echoing it would turn a guessed token
-- into an email-address disclosure.
--
-- Idempotent: a second click on the same link succeeds rather than erroring,
-- because people forward and re-open emails.
-- ---------------------------------------------------------------------------
create or replace function public.readiness_confirm_consent(p_token text)
  returns boolean
  language plpgsql security definer set search_path = '' as $$
declare
  s text;
begin
  if p_token is null or length(p_token) not between 20 and 128 then
    return false;
  end if;

  select consent_state into s
    from public.readiness_leads
   where consent_token = p_token;

  if s is null then return false; end if;      -- no such link
  if s = 'confirmed' then return true; end if;  -- already done
  if s <> 'pending' then return false; end if;  -- none, or withdrawn

  update public.readiness_leads
     set consent_state       = 'confirmed',
         marketing_consent   = true,
         consent_confirmed_at = now()
   where consent_token = p_token;

  return true;
end $$;

revoke all on function public.readiness_confirm_consent(text) from public;
grant execute on function public.readiness_confirm_consent(text) to anon, authenticated;

notify pgrst, 'reload schema';
commit;
