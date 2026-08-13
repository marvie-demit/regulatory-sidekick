-- ============================================================================
-- 0019_document_drafts.sql — what the agent drafted, WITHOUT what it says.
--
-- Until now the platform only knew "In progress". The agent's output lived in a
-- folder on the customer's machine and was invisible to anyone who did not open
-- it. This table closes that gap by recording that a draft EXISTS — its path,
-- its size, how many open questions it carries — and nothing about its content.
--
-- The no-content promise is structural, not a convention
--   • There is no content column, and none may be added: the whole product
--     claim is "your documents never leave your machine" (see the npm README
--     and docs/agentic/SPEC.md). A column here would silently retract it.
--   • Every text column is length-capped, so the table cannot be repurposed as
--     a smuggling channel by an over-helpful client stuffing a document into
--     `path`. A cap you can point at beats a policy you have to trust.
--   • `path` must sit under 20_Drafts/ — the same containment the MCP server
--     enforces on disk (packages/rsk-mcp/src/qms.ts). A row claiming a path in
--     00_Controlled/ would assert the agent wrote somewhere it must never write.
--     Paths are stored with forward slashes; the client normalises, because a
--     Windows agent produces backslashes and two spellings of one path would
--     defeat the unique constraint below.
--
-- Who writes what
--   • The AGENT writes rows through the API (service role), never directly —
--     so org_id comes from the token, never from the caller.
--   • A MEMBER may only mark a draft reviewed. Column-level grants restrict
--     that UPDATE to (reviewed_at, reviewed_by), so a member cannot rewrite
--     path, bytes or counts to make the agent look like it did more than it did.
--   • One row per (org, document): re-drafting updates in place rather than
--     accumulating, so the badge shows the current state and not a history.
--
-- Also adds the write:drafts scope. Reporting a draft is a SEPARATE grant from
-- reading templates: a workspace can let an agent draft into a folder while
-- refusing to let it report anything back. Existing keys carry neither and must
-- be re-issued — same accepted breakage as 0018, and for the same reasons.
--
-- Idempotent; safe to re-run.
-- ============================================================================
begin;

create table if not exists public.document_drafts (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations(id) on delete cascade,
  -- corpus document id, e.g. "AES-SOP-01"
  doc_id         text not null,
  -- the activity it implements, e.g. "AES.setup" (informational; not a FK —
  -- activity ids live in content.json, not in the database)
  activity_id    text,
  -- path RELATIVE to the customer's QMS root — never an absolute path, which
  -- would leak a username and a folder layout for no benefit
  path           text not null,
  bytes          integer not null default 0,
  open_questions integer not null default 0,
  warnings       integer not null default 0,
  -- when it last passed its own contract; a draft that fails is rejected with
  -- 422 and writes no row at all
  validated_at   timestamptz not null default now(),
  -- e.g. "rsk-mcp/0.1.0", so a stale client is visible without an auto-updater
  client         text,
  agent_token_id uuid references public.agent_tokens(id) on delete set null,
  reviewed_at    timestamptz,
  reviewed_by    uuid references auth.users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint document_drafts_org_doc_uniq unique (org_id, doc_id),
  constraint document_drafts_doc_chk
    check (doc_id ~ '^[A-Z]{2,4}-[A-Z]{2,3}-[0-9]{2}$'),
  constraint document_drafts_activity_chk
    check (activity_id is null or length(activity_id) <= 64),
  -- Containment + the cap that keeps this table metadata-only.
  constraint document_drafts_path_chk
    check (path like '20\_Drafts/%' and path !~ '\.\.' and length(path) <= 400),
  constraint document_drafts_client_chk
    check (client is null or length(client) <= 64),
  constraint document_drafts_counts_chk
    check (bytes >= 0 and open_questions >= 0 and warnings >= 0),
  constraint document_drafts_reviewed_chk
    check ((reviewed_at is null) = (reviewed_by is null))
);

create index if not exists document_drafts_org_idx
  on public.document_drafts (org_id, validated_at desc);

alter table public.document_drafts enable row level security;

-- Read: any member of the workspace. Nothing here is sensitive by design —
-- that is the whole point of the table.
drop policy if exists dd_select on public.document_drafts;
create policy dd_select on public.document_drafts
  for select to authenticated
  using ((select app.is_member(org_id)));

-- No INSERT policy for authenticated: rows come from the agent API under the
-- service role, which bypasses RLS. A member cannot fabricate a draft record
-- for work that was never done.

-- Update: a member with write access may mark a draft reviewed. The column
-- grants below are what actually limit this to the review fields.
drop policy if exists dd_update on public.document_drafts;
create policy dd_update on public.document_drafts
  for update to authenticated
  using ((select app.can_write(org_id)))
  with check ((select app.can_write(org_id)));

-- Delete: admins only — removing the record of what an agent produced is an
-- administrative act.
drop policy if exists dd_delete on public.document_drafts;
create policy dd_delete on public.document_drafts
  for delete to authenticated
  using ((select app.has_role(org_id, 'admin')));

revoke all on public.document_drafts from anon;
revoke update on public.document_drafts from authenticated;
grant update (reviewed_at, reviewed_by) on public.document_drafts to authenticated;

-- --------------------------------------------------------------------------
-- The fourth agent scope.
-- --------------------------------------------------------------------------

alter table public.agent_tokens
  drop constraint if exists agent_tokens_scopes_chk;

alter table public.agent_tokens
  add constraint agent_tokens_scopes_chk
  check (
    scopes <@ array['read', 'read:documents', 'write:status', 'write:drafts']::text[]
    and array_length(scopes, 1) >= 1
  );

commit;
