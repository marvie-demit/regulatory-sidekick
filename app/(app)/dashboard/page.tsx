import { content, pnum } from "@/lib/content/content";
import { DashboardClient } from "@/components/content/DashboardClient";

export const metadata = { title: "Dashboard" };

export default function DashboardPage() {
  const acts = content.activities.map((a) => ({
    id: a.id,
    statement: a.statement,
    phaseN: pnum(a.phase),
    // per-phase start order — drives the "Next up" recommendation
    wave: parseInt(String(a.wave || "W1").slice(1), 10) || 1,
    depends: a.depends || "-",
    workstream: (a as { workstream?: string }).workstream || "tf",
    qse: a.qse,
    dur: a.dur || 0,
    es: a.es || 0,
    ef: a.ef || 0,
    mods: a.mods || [],
    reg: a.reg || [],
    ord: (a as { ord?: number }).ord || 0,
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
    />
  );
}
