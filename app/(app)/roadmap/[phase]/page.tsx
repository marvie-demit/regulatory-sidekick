import Link from "next/link";
import { notFound } from "next/navigation";
import {
  content,
  activitiesByPhase,
  CRITset,
  pnum,
  idnum,
} from "@/lib/content/content";
import { RoadmapViews } from "@/components/content/RoadmapViews";
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
    es: a.es || 0,
    ef: a.ef || 0,
    mods: a.mods || [],
    reg: a.reg || [],
    depends: a.depends || "-",
    wave: a.wave || "W1",
  }));
  // whole-project acts for the Timeline mode (all phases, scoped client-side)
  const allActs = content.activities.map((a) => ({
    id: a.id,
    statement: a.statement,
    phaseN: pnum(a.phase),
    dur: a.dur || 0,
    es: a.es || 0,
    ef: a.ef || 0,
    mods: a.mods || [],
    reg: a.reg || [],
    ord: idnum(a.id),
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

      <p className="lead mt-4">{ph.focus}.</p>

      <div className="mt-6">
        <RoadmapViews
          phaseActs={acts}
          allActs={allActs}
          projectDays={content.projectDays}
          critSet={CRITset}
          plan={org?.plan}
          phase={n}
        />
      </div>
    </main>
  );
}
