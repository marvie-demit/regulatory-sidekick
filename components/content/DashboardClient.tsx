"use client";

import Link from "next/link";
import { useOrgState } from "@/components/app-shell/StateProvider";
import type { Phase, ModuleDef } from "@/lib/content/types";
import { actInScope, docInScope } from "@/lib/content/scope";

type Act = {
  id: string;
  phaseN: number;
  qse: string;
  dur: number;
  es: number;
  ef: number;
  mods: string[];
  reg?: string[];
};
type DocScope = { module: string; reg?: string[] };

const PC = ["var(--t5)", "var(--t6)", "var(--t8)", "var(--t9)"];

function fmtWk(d: number) {
  const w = Math.round((d / 5) * 10) / 10;
  return (w % 1 === 0 ? w : w.toFixed(1)) + " week" + (w === 1 ? "" : "s");
}

export function DashboardClient({
  phases,
  acts,
  modules,
  docScopes,
  totalDocs,
}: {
  phases: Phase[];
  acts: Act[];
  modules: ModuleDef[];
  docScopes: DocScope[];
  totalDocs: number;
}) {
  const { status, profile } = useOrgState();

  const scoped = acts.filter((a) => actInScope(a, profile));

  let na = 0,
    done = 0,
    inprog = 0,
    tot = 0;
  scoped.forEach((a) => {
    tot++;
    const s = status[a.id];
    if (s === "N-A") na++;
    else if (s === "Done") done++;
    else if (s === "In progress") inprog++;
  });
  const base = tot - na;
  const pct = base ? Math.round((done / base) * 100) : 0;
  const docsInScope = docScopes.filter((d) => docInScope(d, profile)).length;
  const actsInScope = scoped.length;
  const activeMods = profile ? modules.filter((m) => profile[m.code]) : [];

  function phaseProg(n: number) {
    const pa = scoped.filter((a) => a.phaseN === n);
    const d = pa.filter((a) => status[a.id] === "Done").length;
    return { done: d, total: pa.length };
  }
  function phaseDur(n: number) {
    const pa = scoped.filter((a) => a.phaseN === n);
    if (!pa.length) return 0;
    const s = Math.min(...pa.map((a) => a.es));
    const e = Math.max(...pa.map((a) => a.ef));
    return e - s;
  }

  const kpis = [
    { l: "Implementation", v: pct + "%", s: "of applicable activities", accent: true },
    { l: "Done", v: done, s: "activities complete" },
    { l: "In progress", v: inprog, s: "activities underway" },
    {
      l: "Activities",
      v: actsInScope,
      s: profile ? "in your scope" : "across 4 phases",
    },
    {
      l: "Controlled documents",
      v: docsInScope,
      s: profile ? "in your scope" : "in your plan",
    },
  ];

  return (
    <main className="px-7 py-6">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-teal-900">
        Dashboard
      </h1>
      {profile ? (
        <p className="mt-2 mb-1 text-sm text-muted">
          <b className="text-teal-800">
            Core
            {activeMods.length
              ? " · " + activeMods.map((m) => m.code).join(" · ")
              : ""}
          </b>{" "}
          — {docsInScope}/{totalDocs} documents · {actsInScope}/{acts.length}{" "}
          activities in your scope ·{" "}
          <Link href="/profile" className="font-medium text-coral hover:underline">
            device profile
          </Link>
        </p>
      ) : (
        <p className="mt-2 mb-1 text-sm text-muted">
          <Link href="/profile" className="font-semibold text-coral hover:underline">
            Set your device profile →
          </Link>{" "}
          to scope the plan to your device.
        </p>
      )}

      <div className="kpis mt-4">
        {kpis.map((k, i) => (
          <div key={i} className={"kpi" + (k.accent ? " accent" : "")}>
            <div className="kl">{k.l}</div>
            <div className="kv">{k.v}</div>
            <div className="ks">{k.s}</div>
          </div>
        ))}
      </div>

      <div className="sect-h">Phase progress</div>
      <div className="pgrid">
        {phases.map((p, i) => {
          const pg = phaseProg(p.n);
          const pc = pg.total ? Math.round((pg.done / pg.total) * 100) : 0;
          const short = p.focus.split(/:| - /)[0].trim();
          return (
            <Link
              key={p.n}
              href={`/roadmap/${p.n}`}
              className="pgcard"
              title={p.focus}
              aria-label={`Phase ${p.n}: ${short}, ${pg.done} of ${pg.total} done`}
            >
              <div className="bar" style={{ background: PC[i] }} />
              <div className="bd">
                <div className="ph">PHASE {p.n}</div>
                <h3>{short}</h3>
                <div className="pgbar">
                  <i style={{ width: pc + "%" }} />
                </div>
                <div className="pgm">
                  {pg.done} / {pg.total} done · {pc}% · ≈ {fmtWk(phaseDur(p.n))}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

    </main>
  );
}
