import Link from "next/link";
import {
  Assessment,
  type CoreAnchorChoice,
  type PhaseInfo,
} from "@/components/readiness/Assessment";
import { CORE_PROCESSES, phaseTitle } from "@/lib/readiness/assessment";
import { content, counts, pnum } from "@/lib/content/content";

// Rung 1 of the ladder (BUSINESS-MODEL.md §3): a free, email-gated readiness
// self-assessment, and the only paid-product page a logged-out visitor can
// complete end to end. PUBLIC — outside the (app) group, like /impressum and
// /privacy, and listed in PUBLIC_PREFIXES in lib/supabase/proxy.ts. Without that
// entry the proxy bounces every visitor to /login, which would make a free lead
// magnet reachable only by people who already have an account.

export const metadata = {
  title: "Free MDR / ISO 13485 readiness assessment",
  description:
    "Score your MDR or IVDR and ISO 13485 readiness in about five minutes. A breakdown by phase and by quality system essential, and the specific implementation activity that closes each gap. Free, no account.",
};

export default function ReadinessPage() {
  const n = counts();

  // Everything the questionnaire needs, projected down to what it will actually
  // render. Deliberately not the whole corpus: the activity list is passed only
  // so the client can show truthful in-scope counts, so it carries the two
  // scoping axes and nothing else.
  const phases: PhaseInfo[] = content.phases.map((p) => ({
    n: p.n,
    name: phaseTitle(p.focus, p.n),
    focus: p.focus,
  }));

  const acts = content.activities.map((a) => ({
    id: a.id,
    phase: pnum(a.phase),
    mods: a.mods,
    reg: a.reg,
  }));

  // Candidate anchors per core process, with the statements, so the question
  // text is the corpus's own wording rather than a paraphrase of it.
  const coreAnchors: CoreAnchorChoice[] = CORE_PROCESSES.map((def) => ({
    key: def.key,
    candidates: def.anchors.flatMap((id) => {
      const a = content.activities.find((x) => x.id === id);
      return a
        ? [{ id: a.id, statement: a.statement, mods: a.mods, reg: a.reg }]
        : [];
    }),
  }));

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-12">
      <Link
        href="/"
        className="text-sm font-semibold text-teal-600 hover:text-coral"
      >
        ← Regulatory Sidekick
      </Link>

      <div className="mt-8">
        <Assessment
          modules={content.modules}
          phases={phases}
          acts={acts}
          coreAnchors={coreAnchors}
          activityCount={n.activities}
        />
      </div>

      <footer className="mt-12 flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-line pt-6 text-xs">
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
