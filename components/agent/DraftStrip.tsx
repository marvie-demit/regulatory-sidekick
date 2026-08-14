"use client";

import { useState, useTransition } from "react";
import { markDraftReviewed } from "@/lib/agent/draft-actions";

/**
 * "An agent drafted this, and it is on your machine — not here."
 *
 * The path is the useful part: it is where the reader has to go to actually
 * read the thing. Everything on this strip is metadata; the document itself
 * never reaches the server, so there is deliberately no preview and no
 * download. Saying that plainly is better than leaving someone hunting for a
 * button that cannot exist.
 */
export function DraftStrip({
  docId,
  path,
  bytes,
  openQuestions,
  warnings,
  drafted,
  reviewed: initialReviewed,
  canReview,
}: {
  docId: string;
  path: string;
  bytes: number;
  openQuestions: number;
  warnings: number;
  drafted: string;
  reviewed: boolean;
  canReview: boolean;
}) {
  const [reviewed, setReviewed] = useState(initialReviewed);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function toggle() {
    const next = !reviewed;
    setError(null);
    start(async () => {
      const r = await markDraftReviewed(docId, next);
      if (r.error) setError(r.error);
      else setReviewed(next);
    });
  }

  const kb = bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;

  return (
    <div className="mx-auto mt-4 max-w-[840px] rounded-lg border border-line bg-cream px-4 py-2.5 text-sm text-muted">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <b className="text-teal-800">{reviewed ? "Reviewed draft" : "Agent draft"}</b>
        <code className="rounded-md border border-line bg-card px-2 py-0.5 text-[11.5px] font-medium text-teal-900">
          {path}
        </code>
        <span>{kb}</span>
        {openQuestions > 0 ? (
          <>
            <span>·</span>
            <span className="font-medium text-[#8a5a12]">
              {openQuestions} open question{openQuestions === 1 ? "" : "s"}
            </span>
          </>
        ) : null}
        {warnings > 0 ? (
          <>
            <span>·</span>
            <span>
              {warnings} warning{warnings === 1 ? "" : "s"}
            </span>
          </>
        ) : null}
        <span>·</span>
        <span>drafted {drafted}</span>

        {canReview ? (
          <button
            type="button"
            onClick={toggle}
            disabled={pending}
            className="ml-auto rounded-full border border-line bg-card px-3 py-1 text-[12px] font-semibold text-teal-800 transition hover:border-coral disabled:opacity-50"
          >
            {pending
              ? "Saving…"
              : reviewed
                ? "Clear review"
                : "Mark reviewed"}
          </button>
        ) : null}
      </div>

      {openQuestions > 0 ? (
        <p className="mt-1.5 text-[12.5px]">
          The agent left {openQuestions === 1 ? "a marker" : "markers"} it could
          not answer. They are listed in <code>OPEN-QUESTIONS.md</code> in your
          QMS folder.
        </p>
      ) : null}

      {error ? (
        <p className="mt-1.5 text-[12.5px] font-medium text-coral">{error}</p>
      ) : null}
    </div>
  );
}
