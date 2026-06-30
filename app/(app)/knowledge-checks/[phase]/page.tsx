import Link from "next/link";
import { notFound } from "next/navigation";
import { content } from "@/lib/content/content";
import { Quiz } from "@/components/content/Quiz";

export function generateStaticParams() {
  return content.phases.map((p) => ({ phase: String(p.n) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ phase: string }>;
}) {
  const { phase } = await params;
  return { title: `Phase ${phase} knowledge check` };
}

export default async function QuizPage({
  params,
}: {
  params: Promise<{ phase: string }>;
}) {
  const { phase } = await params;
  const n = parseInt(phase, 10);
  const questions = content.questions[String(n)] || [];
  if (!(n >= 1 && n <= 4) || !questions.length) notFound();
  const ph = content.phases[n - 1];

  return (
    <main className="mx-auto max-w-3xl px-8 py-10">
      <Link
        href="/knowledge-checks"
        className="text-sm font-medium text-teal-600 hover:underline"
      >
        ← Knowledge checks
      </Link>
      <h1 className="font-display mt-3 text-3xl font-semibold tracking-tight text-teal-900">
        Phase {n} · Knowledge check
      </h1>
      <p className="mt-2 text-muted">{ph.focus}</p>
      <Quiz phase={n} questions={questions} />
    </main>
  );
}
