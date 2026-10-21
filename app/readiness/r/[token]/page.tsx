import Link from "next/link";
import { notFound } from "next/navigation";
import { Report } from "@/components/readiness/Report";
import { requestOrigin } from "@/lib/http/origin";
import { resultByToken } from "@/lib/readiness/store";

// The permanent, forwardable copy of a readiness result.
//
// This page is the reason rung 1 works as an institutional door-opener:
// BUSINESS-MODEL.md §6.3 offers to "run our readiness assessment on a company
// you're diligencing right now so you can see the output before we talk
// commercials" — which needs a URL, not a screenshot.
//
// Public by token. The read goes through readiness_result_by_token() on the
// ordinary anon client, which returns the score and the name on it and NOTHING
// else: no email, no consent flag, no answers. So a leaked or guessed token
// exposes one company's score, never the lead list. See migration 0024.

export const metadata = {
  title: "Readiness assessment",
  // A result is somebody's private-ish artefact; it should not turn up in search.
  robots: { index: false, follow: false },
};

export default async function SharedResultPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const stored = await resultByToken(token);
  if (!stored) notFound();

  const origin = await requestOrigin();

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-12">
      <Link
        href="/"
        className="text-sm font-semibold text-teal-600 hover:text-coral"
      >
        ← Regulatory Sidekick
      </Link>

      <div className="mt-8">
        <Report
          result={stored.result}
          shareUrl={`${origin}/readiness/r/${token}`}
        />
      </div>

      <section className="mt-8 rounded-xl border border-line bg-cream px-5 py-4">
        <p className="text-sm text-ink">
          <b className="text-teal-900">Not your assessment?</b> This result was
          produced by whoever answered the questionnaire, and anyone with the
          link can read it.{" "}
          <Link
            href="/readiness"
            className="font-semibold text-teal-700 hover:underline"
          >
            Run your own
          </Link>{" "}
          — it is free and takes about five minutes.
        </p>
      </section>

      <footer className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-line pt-6 text-xs">
        <Link
          href="/readiness"
          className="font-semibold text-teal-800 transition hover:text-coral"
        >
          Readiness assessment
        </Link>
        <Link
          href="/pricing"
          className="font-semibold text-teal-800 transition hover:text-coral"
        >
          Pricing
        </Link>
        <Link
          href="/impressum"
          className="font-semibold text-teal-800 transition hover:text-coral"
        >
          Impressum
        </Link>
        <Link
          href="/privacy"
          className="font-semibold text-teal-800 transition hover:text-coral"
        >
          Privacy
        </Link>
      </footer>
    </main>
  );
}
