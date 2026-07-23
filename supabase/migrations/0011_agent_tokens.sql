-- ============================================================================
-- 0011_agent_tokens.sql — admin-approved machine access to a workspace.
--
-- Lets a member mint a scoped API token so an agent can work the workspace's
-- implementation stepwise (read what's next, mark activities done). The token
-- is INERT until an admin approves it, is scope-limited, expires, and is
-- revocable — and every action it takes lands in audit_log attributed to the
-- member who created it.
--
-- Security model
--   • The token itself carries the workspace binding. The API resolves
--     token -> org_id server-side and NEVER accepts an org_id from the caller.
--   • Only the SHA-256 hash is stored. The raw token is shown once, at creation.
--   • status starts 'pending' and cannot be self-set: the INSERT policy forces
--     'pending', and only an admin may UPDATE (approve / revoke). Column-level
--     grants further limit that UPDATE to (status, approved_by, approved_at),
--     so org_id / token_hash / scopes can never be swapped on an existing row.
--   • Scopes are capped at the allowed set here; the server action additionally
--     caps them at the creating member's own role (no self-escalation).
-- Idempotent; safe to re-run.
-- ============================================================================
begin;

create table if not exists public.agent_tokens (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  name          text not null,
  -- sha256(raw token) — the raw value is shown once and never stored
  token_hash    text not null unique,
  -- non-secret display prefix, e.g. "rsk_a1b2c3" (for "which key is this?")
  token_prefix  text not null,
  scopes        text[] not null default '{read}',
  status        text not null default 'pending',
  created_by    uuid not null references auth.users(id) on delete cascade,
  approved_by   uuid references auth.users(id),
  approved_at   timestamptz,
  last_used_at  timestamptz,
  expires_at    timestamptz not null default now() + interval '90 days',
  created_at    timestamptz not null default now(),
  constraint agent_tokens_status_chk
    check (status in ('pending', 'active', 'revoked')),
  constraint agent_tokens_scopes_chk
    check (scopes <@ array['read', 'write:status']::text[] and array_length(scopes, 1) >= 1)
);

create index if not exists agent_tokens_org_idx on public.agent_tokens (org_id, created_at desc);
create index if not exists agent_tokens_hash_idx on public.agent_tokens (token_hash);

alter table public.agent_tokens enable row level security;

-- Read: any member of the workspace can see its tokens (hash is never selected
-- by the app; even if it were, it's a one-way hash).
drop policy if exists at_select on public.agent_tokens;
create policy at_select on public.agent_tokens
  for select to authenticated
  using ((select app.is_member(org_id)));

-- Create: a member (not a viewer) may REQUEST a token for their own workspace.
-- Forced to land as an unapproved 'pending' row owned by the caller.
drop policy if exists at_insert on public.agent_tokens;
create policy at_insert on public.agent_tokens
  for insert to authenticated
  with check (
    (select app.can_write(org_id))
    and created_by = (select auth.uid())
    and status = 'pending'
    and approved_by is null
    and approved_at is null
  );

-- Approve / revoke: admins only (column grants below restrict WHAT they change).
drop policy if exists at_update on public.agent_tokens;
create policy at_update on public.agent_tokens
  for update to authenticated
  using ((select app.has_role(org_id, 'admin')))
  with check ((select app.has_role(org_id, 'admin')));

-- Delete: the creator can withdraw their own request; admins can delete any.
drop policy if exists at_delete on public.agent_tokens;
create policy at_delete on public.agent_tokens
  for delete to authenticated
  using (
    (select app.is_member(org_id))
    and (created_by = (select auth.uid()) or (select app.has_role(org_id, 'admin')))
  );

-- Column-level lockdown: an approving admin may only move the lifecycle fields.
revoke all on public.agent_tokens from anon;
revoke update on public.agent_tokens from authenticated;
grant update (status, approved_by, approved_at) on public.agent_tokens to authenticated;

commit;
