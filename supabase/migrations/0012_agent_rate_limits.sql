-- ============================================================================
-- 0012_agent_rate_limits.sql
--
-- (a) BUGFIX: restore workspace-profile editing.
--     0007 revoked table-level UPDATE on organizations and re-granted only
--     (name, slug) to close the plan self-upgrade hole. 0010 then ADDED the
--     company-profile columns without granting them, so every "Save profile"
--     has been failing with `permission denied for table organizations`.
--     Re-grant exactly the profile columns — plan / plan_expires_at and the new
--     agent-limit columns below stay ungranted, so the paywall stays shut.
--
-- (b) Agent rate limiting. Two independent budgets per key:
--       • requests per minute  — stops a runaway loop
--       • WRITES per day       — the one that matters for a quality system:
--         a buggy agent rewriting statuses in a loop is a records-integrity
--         problem (churned records, a useless audit trail), not a throughput one.
--
--     Limits are set PER WORKSPACE (nullable override on organizations; NULL =
--     the app default) and are writable ONLY by the platform admin via the
--     service role — a customer who can raise their own ceiling has no ceiling.
--     Counters live on the token and are advanced by consume_agent_quota()
--     in ONE atomic statement, folded into the existing last_used_at write, so
--     rate limiting costs no extra round trip.
-- Idempotent; safe to re-run.
-- ============================================================================
begin;

-- (a) -----------------------------------------------------------------------
grant update (name, slug, website, linkedin, industry, country, about)
  on public.organizations to authenticated;

-- (b) -----------------------------------------------------------------------
alter table public.organizations
  add column if not exists agent_rate_limit  int,   -- requests/minute, NULL = default
  add column if not exists agent_write_limit int;   -- writes/day,      NULL = default

alter table public.agent_tokens
  add column if not exists rate_window_start  timestamptz not null default now(),
  add column if not exists rate_count         int         not null default 0,
  add column if not exists write_window_start timestamptz not null default now(),
  add column if not exists write_count        int         not null default 0;

-- Advance both windows and report whether this request is allowed.
-- The single UPDATE is atomic, so concurrent lambdas can't race the counter
-- (every SET expression sees the OLD row, hence the repeated window test).
create or replace function public.consume_agent_quota(
  p_token       uuid,
  p_rate_limit  int,
  p_write_limit int,
  p_is_write    boolean
)
returns table (
  allowed     boolean,
  reason      text,
  rate_used   int,
  rate_reset  timestamptz,
  write_used  int,
  write_reset timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_allowed boolean := true;
  v_reason  text    := null;
begin
  update public.agent_tokens t
     set rate_window_start = case
           when t.rate_window_start < now() - interval '1 minute' then now()
           else t.rate_window_start end,
         rate_count = case
           when t.rate_window_start < now() - interval '1 minute' then 1
           else t.rate_count + 1 end,
         write_window_start = case
           when t.write_window_start < now() - interval '1 day' then now()
           else t.write_window_start end,
         write_count = case
           when t.write_window_start < now() - interval '1 day'
             then (case when p_is_write then 1 else 0 end)
           else t.write_count + (case when p_is_write then 1 else 0 end) end,
         last_used_at = now()
   where t.id = p_token
   returning t.rate_count, t.rate_window_start, t.write_count, t.write_window_start
   into r;

  if not found then
    return query select false, 'unknown'::text, 0, now(), 0, now();
    return;
  end if;

  -- A denied request still counts: a hammering client stays blocked until the
  -- window rolls, rather than being handed a free retry every time.
  if r.rate_count > p_rate_limit then
    v_allowed := false; v_reason := 'rate';
  elsif p_is_write and r.write_count > p_write_limit then
    v_allowed := false; v_reason := 'write';
  end if;

  return query select
    v_allowed, v_reason,
    r.rate_count,  r.rate_window_start + interval '1 minute',
    r.write_count, r.write_window_start + interval '1 day';
end;
$$;

-- Only the API (service role) may spend quota. Never the end user.
revoke all on function public.consume_agent_quota(uuid, int, int, boolean)
  from public, anon, authenticated;
grant execute on function public.consume_agent_quota(uuid, int, int, boolean)
  to service_role;

commit;
