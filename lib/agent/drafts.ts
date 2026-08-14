import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * What the agent has drafted, as the app sees it.
 *
 * Metadata only — there is no content column to read (migration 0019). A draft
 * lives on the customer's machine; this is the record that one exists, which is
 * what turns "In progress" into "3 of 5 documents drafted, 4 open questions".
 */
export type DraftRecord = {
  docId: string;
  activityId: string | null;
  path: string;
  bytes: number;
  openQuestions: number;
  warnings: number;
  validatedAt: string;
  reviewedAt: string | null;
};

export type DraftIndex = {
  byDoc: Map<string, DraftRecord>;
  byActivity: Map<string, DraftRecord[]>;
  total: number;
  openQuestions: number;
  unreviewed: number;
};

const empty = (): DraftIndex => ({
  byDoc: new Map(),
  byActivity: new Map(),
  total: 0,
  openQuestions: 0,
  unreviewed: 0,
});

/**
 * One query, folded into lookup maps for the page to index by document or by
 * activity. Wrapped in try/catch on the same reasoning as `listOrgs`: a
 * deployment that has not applied 0019 yet should render a library with no
 * badges, not a 500 on the library.
 */
export async function readDrafts(orgId: string | undefined): Promise<DraftIndex> {
  if (!orgId) return empty();
  try {
    const db = await createClient();
    const { data, error } = await db
      .from("document_drafts")
      .select(
        "doc_id, activity_id, path, bytes, open_questions, warnings, validated_at, reviewed_at",
      )
      .eq("org_id", orgId);
    if (error || !data) return empty();

    const idx = empty();
    for (const r of data) {
      const rec: DraftRecord = {
        docId: r.doc_id,
        activityId: r.activity_id,
        path: r.path,
        bytes: r.bytes ?? 0,
        openQuestions: r.open_questions ?? 0,
        warnings: r.warnings ?? 0,
        validatedAt: r.validated_at,
        reviewedAt: r.reviewed_at,
      };
      idx.byDoc.set(rec.docId, rec);
      if (rec.activityId) {
        const list = idx.byActivity.get(rec.activityId) ?? [];
        list.push(rec);
        idx.byActivity.set(rec.activityId, list);
      }
      idx.total += 1;
      idx.openQuestions += rec.openQuestions;
      if (!rec.reviewedAt) idx.unreviewed += 1;
    }
    return idx;
  } catch {
    return empty();
  }
}
