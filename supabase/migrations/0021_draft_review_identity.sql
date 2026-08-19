-- ============================================================================
-- 0021_draft_review_identity.sql — a reviewer may only sign as themselves.
--
-- 0019 used column grants as the enforcement boundary and said so:
-- "a member cannot rewrite path, bytes or counts". That half held. But
-- reviewed_by was itself inside the grant, and nothing tied its VALUE to the
-- caller:
--
--   grant update (reviewed_at, reviewed_by) on public.document_drafts
--     to authenticated;
--
-- lib/agent/draft-actions.ts sets reviewed_by = the signed-in user, correctly.
-- That is the application being careful, and that function's own comment argues
-- the database is the guarantee precisely so it does not have to be. PostgREST
-- is reachable directly with a member's session JWT — the URL and anon key are
-- NEXT_PUBLIC_ and inlined into the browser bundle — so the server action is
-- not on the path at all.
--
-- A member could therefore read a colleague's uuid from `memberships` (which
-- mem_select permits) and PATCH document_drafts to assert that THEY reviewed an
-- agent-drafted controlled document. No audit row would follow: the audit
-- insert lives only in the server action, and 0008 revoked INSERT on audit_log
-- from authenticated, so the forgery could not even be given a matching entry.
--
-- In a quality system a signed-off document is the artefact an auditor asks
-- for. Forging whose name is on it is the interesting attack, not tampering
-- with a byte count.
--
-- Fixed in the POLICY rather than with a trigger. The agent's re-draft path is
-- a service-role upsert where auth.uid() is null, so a BEFORE UPDATE trigger
-- pinning the reviewer would null reviewed_by on every agent write and trip
-- document_drafts_reviewed_chk. Service role bypasses RLS, so tightening the
-- policy leaves the agent untouched.
--
-- Clearing a review is still allowed (reviewed_by null), which is what the
-- "Clear review" button does.
--
-- Idempotent; safe to re-run.
-- ============================================================================
begin;

drop policy if exists dd_update on public.document_drafts;
create policy dd_update on public.document_drafts
  for update to authenticated
  using ((select app.can_write(org_id)))
  with check (
    (select app.can_write(org_id))
    and (reviewed_by is null or reviewed_by = (select auth.uid()))
  );

commit;
