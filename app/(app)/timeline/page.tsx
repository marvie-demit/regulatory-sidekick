import { content, pnum, idnum, CRITset } from "@/lib/content/content";
import { TimelineView } from "@/components/content/TimelineView";

export const metadata = { title: "Timeline" };

export default function TimelinePage() {
  const acts = content.activities.map((a) => ({
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

  return (
    <main className="mx-auto max-w-5xl px-8 py-10">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-teal-900">
        Timeline
      </h1>
      <TimelineView
        acts={acts}
        projectDays={content.projectDays}
        critSet={CRITset}
      />
    </main>
  );
}
