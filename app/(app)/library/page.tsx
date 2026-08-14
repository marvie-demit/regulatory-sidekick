import { LibraryView, type DraftBadge } from "@/components/content/LibraryView";
import { getActiveOrg } from "@/lib/auth/org";
import { content, counts } from "@/lib/content/content";
import { readDrafts } from "@/lib/agent/drafts";

export const metadata = { title: "Document library" };

type Proc = { name: string; module?: string };

export default async function LibraryPage() {
  const org = await getActiveOrg();

  // Metadata only — a Map of doc id to "a draft exists, with N open questions".
  // Flattened to a plain object because LibraryView is a client component and a
  // Map does not survive the boundary.
  const drafts = await readDrafts(org?.id);
  const badges: Record<string, DraftBadge> = {};
  for (const [docId, r] of drafts.byDoc)
    badges[docId] = { openQuestions: r.openQuestions, reviewed: !!r.reviewedAt };

  return (
    <LibraryView
      documents={content.documents}
      procs={(content.procs ?? {}) as Record<string, Proc>}
      procOrder={content.procOrder ?? []}
      totalDocs={counts().documents}
      plan={org?.plan}
      drafts={badges}
    />
  );
}
