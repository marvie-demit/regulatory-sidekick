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
    <TimelineView
      acts={acts}
      projectDays={content.projectDays}
      critSet={CRITset}
    />
  );
}
