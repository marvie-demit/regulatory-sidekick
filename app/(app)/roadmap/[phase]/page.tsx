import Link from "next/link";
import { notFound } from "next/navigation";
import {
  content,
  activitiesByPhase,
  idnum,
  EDGES,
  CRITset,
  CRITe,
} from "@/lib/content/content";
import { WaveMap } from "@/components/content/WaveMap";
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
    wave: a.wave,
    dur: a.dur || 0,
    mods: a.mods || [],
    ord: idnum(a.id),
  }));
  const idset = new Set(acts.map((a) => a.id));
  const edges = EDGES.filter(([u, v]) => idset.has(u) && idset.has(v));
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
        {ph.focus}. Activities are laid out in dependency{" "}
        <b className="text-teal-800">waves</b> left→right — finish a wave before
        the work that depends on it. <b style={{ color: "#993c1d" }}>Coral</b>{" "}
        traces the critical path; the dot shows each activity&apos;s status.
        Select any card to open it.
      </p>

      <div className="mt-6">
        <WaveMap
          acts={acts}
          edges={edges}
          critSet={CRITset}
          crite={CRITe}
          plan={org?.plan}
        />
      </div>
    </main>
  );
}
