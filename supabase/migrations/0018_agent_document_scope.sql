-- ============================================================================
-- 0018_agent_document_scope.sql — a third agent scope: read:documents.
--
-- Fetching a blank controlled-document template is a SEPARATE grant from
-- reading the plan. A workspace can hand an agent the roadmap without handing
-- it the 275 templates, or the templates without the ability to write anything
-- back. That separation is the point: it is a control a customer can actually
-- point at, and it mirrors how write:status is already opt-in.
--
-- Why the templates are served through the API at all, rather than bundled into
-- the agent package: a published tarball hands anyone the corpus with no
-- account and no trace, and — the part that decides it — bundled files SURVIVE
-- REVOCATION, defeating the per-request hasAgenticAccess() check that exists so
-- switching agent access off is immediate. See docs/agentic/BUILD.md Slice 2.
--
-- EXISTING KEYS: keys minted before this carry {read} or {read, write:status}
-- and will 403 on the template endpoint until re-issued. Accepted deliberately —
-- agent access is admin-gated, capped at 3 keys per workspace, brand new, and
-- keys expire after 90 days anyway. Retrofitting the scope later would force the
-- same re-issue against a live customer base instead of none.
--
-- Idempotent; safe to re-run.
-- ============================================================================
begin;

alter table public.agent_tokens
  drop constraint if exists agent_tokens_scopes_chk;

alter table public.agent_tokens
  add constraint agent_tokens_scopes_chk
  check (
    scopes <@ array['read', 'read:documents', 'write:status']::text[]
    and array_length(scopes, 1) >= 1
  );

commit;
