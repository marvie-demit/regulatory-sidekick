"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useOrgState } from "@/components/app-shell/StateProvider";
import { stcls } from "@/components/content/StatusDropdown";

type TAct = {
  id: string;
  statement: string;
  phaseN: number;
  dur: number;
  es: number;
  ef: number;
  mods: string[];
  ord: number;
};

function fmtWk(d: number) {
  const w = Math.round((d / 5) * 10) / 10;
  return `${w % 1 === 0 ? w : w.toFixed(1)} week${w === 1 ? "" : "s"}`;
}

export function TimelineView({
  acts,
  projectDays,
  critSet,
}: {
  acts: TAct[];
  projectDays: number;
  critSet: Record<string, number>;
}) {
  const { status, profile } = useOrgState();

  const inScope = (a: TAct) =>
    !profile ||
    !a.mods.length ||
    a.mods.indexOf("Core") >= 0 ||
    a.mods.some((m) => profile[m]);
  const scoped = acts
    .filter(inScope)
    .slice()
    .sort((a, b) => a.es - b.es || a.ord - b.ord);
  const total = (scoped.length ? Math.max(...scoped.map((a) => a.ef)) : projectDays) || 1;
  const weeks = Math.ceil(total / 5);

  return (
    <main className="mx-auto max-w-5xl px-8 py-10">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-teal-900">
        Timeline
      </h1>
      <p className="lead mt-3">
        Auto-scheduled from each activity&apos;s estimated duration and its
        dependencies (critical-path method). Total ≈{" "}
        <b className="text-teal-800">{fmtWk(total)}</b> ({total} working days) to
        certification. <b style={{ color: "#993c1d" }}>Coral</b> marks the
        critical path. These are planning estimates - tune the durations to your
        project.
      </p>

      <div
        className="gwrap2 mt-6"
        style={{ ["--wk" as string]: `${(5 / total) * 100}%` } as CSSProperties}
      >
        <div className="gaxis">
          <span className="glab" />
          <div className="gtrack gaxt">
            {Array.from({ length: weeks + 1 }).map((_, wk) => (
              <span
                key={wk}
                className="gwk"
                style={{ left: `${((wk * 5) / total) * 100}%` }}
              >
                W{wk}
              </span>
            ))}
          </div>
        </div>

        {[1, 2, 3, 4].map((ph) => {
          const pa = scoped.filter((a) => a.phaseN === ph);
          if (!pa.length) return null;
          const ps = Math.min(...pa.map((a) => a.es));
          const pe = Math.max(...pa.map((a) => a.ef));
          return (
            <div key={ph}>
              <div className="gph">
                <span className="gphn">Phase {ph}</span>
                <span className="gphw">
                  weeks {Math.round((ps / 5) * 10) / 10}–
                  {Math.round((pe / 5) * 10) / 10} · {fmtWk(pe - ps)}
                </span>
              </div>
              {pa.map((a) => {
                const crit = !!critSet[a.id];
                const left = (a.es / total) * 100;
                const w = (a.dur / total) * 100;
                const cls = stcls(status[a.id] || "");
                return (
                  <div key={a.id} className="grow">
                    <Link
                      href={`/activity/${a.id}`}
                      className="glab"
                      title={a.statement}
                    >
                      <b>{a.id}</b> {a.statement.slice(0, 32)}
                      {a.statement.length > 32 ? "…" : ""}
                    </Link>
                    <div className="gtrack">
                      <Link
                        href={`/activity/${a.id}`}
                        className={`gbar${cls ? " " + cls : ""}${crit ? " crit" : ""}`}
                        style={{ left: `${left}%`, width: `${w}%` }}
                        title={`${a.id}: ${a.dur} working days${crit ? " — critical path" : ""}`}
                      >
                        <span>{a.dur}d</span>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </main>
  );
}
