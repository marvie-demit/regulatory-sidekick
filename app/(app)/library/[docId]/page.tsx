import { readFileSync } from "node:fs";
import { join } from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";
import { canViewDocGroup, hasFullAccess } from "@/lib/auth/access";
import { getActiveOrg } from "@/lib/auth/org";
import { byDocId, docActivities } from "@/lib/content/content";
import { docFile } from "@/lib/docs";
import { LockedNotice } from "@/components/content/LockedNotice";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ docId: string }>;
}) {
  const { docId } = await params;
  const d = byDocId[docId];
  return { title: d ? `${d.id} · ${d.title}` : "Document" };
}

export default async function DocViewer({
  params,
}: {
  params: Promise<{ docId: string }>;
}) {
  const { docId } = await params;
  const d = byDocId[docId];
  if (!d) notFound();

  // Server-side gate: a free org may only open documents in the sample group.
  // When not allowed we NEVER read the file, so the template never leaves the server.
  const org = await getActiveOrg();
  const allowed = canViewDocGroup(org?.plan, d.domain);
  const full = hasFullAccess(org?.plan);
  const file = docFile(docId);
  const kind = file?.ext === "xlsx" ? "Excel" : "Word";

  let html = "";
  if (allowed) {
    try {
      html = readFileSync(
        join(process.cwd(), "content", "docs", `${docId}.html`),
        "utf-8",
      );
    } catch {
      html = "";
    }
  }

  const acts = docActivities(docId);

  return (
    <main className="px-8 py-10">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/library"
          className="text-sm font-medium text-teal-600 hover:underline"
        >
          ← Library
        </Link>
        {file && allowed ? (
          full ? (
            <a
              href={`/api/docs/${docId}/download`}
              className="inline-flex items-center gap-1.5 rounded-full bg-teal-800 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
            >
              ↓ Download {kind}
            </a>
          ) : (
            <Link
              href="/pricing"
              className="inline-flex items-center gap-1.5 rounded-full border border-coral px-4 py-2 text-sm font-semibold text-coral transition hover:bg-coral hover:text-white"
            >
              ↓ Download {kind} · Full access
            </Link>
          )
        ) : null}
      </div>

      {acts.length > 0 && (
        <div className="mx-auto mt-4 max-w-[840px] rounded-lg border border-line bg-cream px-4 py-2.5 text-sm text-muted">
          <b className="mr-2 text-teal-800">Implemented by</b>
          {acts.map((a) => (
            <Link
              key={a}
              href={`/activity/${a}`}
              className="mr-1.5 inline-block rounded-md border border-line bg-card px-2 py-0.5 text-[11.5px] font-bold text-teal-700 hover:border-coral"
            >
              {a}
            </Link>
          ))}
        </div>
      )}

      {!allowed ? (
        <div className="mx-auto mt-4 max-w-[840px]">
          <LockedNotice title={`${d.id} · ${d.title}`} />
        </div>
      ) : html ? (
        <div
          className="paper mx-auto mt-4"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <p className="mx-auto mt-4 max-w-[840px] text-center text-muted">
          No rendered preview for {docId}.
        </p>
      )}
    </main>
  );
}
