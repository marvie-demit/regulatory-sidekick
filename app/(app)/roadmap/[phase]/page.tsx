import Link from "next/link";
import { notFound } from "next/navigation";
import { content, activitiesByPhase, CRITset } from "@/lib/content/content";
import { RoadmapTree } from "@/components/content/RoadmapTree";
import { getActiveOrg } from "@/lib/auth/org";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ phase: string }>;
}) {
  const { phase } = await params;
  return { title: `Roadmap · Phase ${phase}` };
}

export default async function RoadmapPage({
  params,
}: {
  params: Promise<{ phase: string }>;
}) {
  const { phase } = await params;
  const n = parseInt(phase, 10);
  if (!(n >= 1 && n <= 4)) notFound();
  const ph = content.phases[n - 1];

  const acts = activitiesByPhase(n).map((a) => ({
    id: a.id,
    statement: a.statement,
    proc: (a as { proc?: string }).proc || "",
    procName: (a as { procName?: string }).procName || "Other",
    tier: (a as { tier?: string }).tier || "core",
    dur: a.dur || 0,
    mods: a.mods || [],
    depends: a.depends || "-",
  }));
  const org = await getActiveOrg();

  return (
    <main className="px-8 py-10">
      <h1 className="font-display mb-6 text-3xl font-semibold tracking-tight text-teal-900">
        Roadmap · Phase {n}
      </h1>

      <div className="ptabs" role="tablist" aria-label="Roadmap phase">
        {content.phases.map((p) => (
          <Link
            key={p.n}
            href={`/roadmap/${p.n}`}
            className={"ptab" + (p.n === n ? " on" : "")}
            aria-current={p.n === n ? "page" : undefined}
          >
            Phase {p.n}
          </Link>
        ))}
      </div>

      <p className="lead mt-4">
        {ph.focus}. Work is grouped by <b className="text-teal-800">process</b>
        {" — "}each branch is a process, and its steps flow left to right in the
        order you do them.{" "}
        <b style={{ color: "#993c1d" }}>Coral</b>
        {" "}marks the critical path; the dot shows each activity&apos;s status.
        Select any card to open it.
      </p>

      <div className="mt-6">
        <RoadmapTree acts={acts} critSet={CRITset} plan={org?.plan} />
      </div>
    </main>
  );
}
