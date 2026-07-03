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
    reg: a.reg || [],
  }));
  const docScopes = content.documents.map((d) => ({
    module: d.module,
    reg: d.reg,
  }));

  return (
    <DashboardClient
      phases={content.phases}
      acts={acts}
      modules={content.modules}
      docScopes={docScopes}
      totalDocs={content.stats.docs}
      critLen={CRIT.length}
    />
  );
}
