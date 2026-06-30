import { content, pnum, CRIT } from "@/lib/content/content";
import { DashboardClient } from "@/components/content/DashboardClient";

export const metadata = { title: "Dashboard" };

export default function DashboardPage() {
  const acts = content.activities.map((a) => ({
    id: a.id,
    phaseN: pnum(a.phase),
    qse: a.qse,
    dur: a.dur || 0,
    es: a.es || 0,
    ef: a.ef || 0,
    mods: a.mods || [],
  }));
  const docModules = content.documents.map((d) => d.module);

  return (
    <DashboardClient
      phases={content.phases}
      acts={acts}
      qses={content.qses}
      modules={content.modules}
      docModules={docModules}
      totalDocs={content.stats.docs}
      critLen={CRIT.length}
    />
  );
}
