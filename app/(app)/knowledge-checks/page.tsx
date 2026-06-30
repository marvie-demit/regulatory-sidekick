import { content } from "@/lib/content/content";
import { KnowledgeChecksOverview } from "@/components/content/KnowledgeChecksOverview";

export const metadata = { title: "Knowledge checks" };

export default function KnowledgeChecksPage() {
  const counts = content.phases.map((p) => ({
    phase: p.n,
    focus: p.focus,
    n: (content.questions[String(p.n)] || []).length,
  }));
  const totalQ = counts.reduce((s, c) => s + c.n, 0);

  return (
    <main className="px-7 py-6">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-teal-900">
        Knowledge checks
      </h1>
      <p className="lead">
        Short self-tests to confirm your team understands each phase of the
        implementation. Pick a phase, answer each question, and see instantly
        whether it is right and why. Your best score per phase is saved.
      </p>
      <KnowledgeChecksOverview counts={counts} totalQ={totalQ} />
    </main>
  );
}
