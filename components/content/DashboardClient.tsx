"use client";

import Link from "next/link";
import { useOrgState } from "@/components/app-shell/StateProvider";
import type { Phase, ModuleDef } from "@/lib/content/types";
import { actInScope, docInScope } from "@/lib/content/scope";

type Act = {
  id: string;
  statement: string;
  phaseN: number;
  wave: number;
  depends: string;
  workstream: string;
  qse: string;
  dur: number;
  es: number;
  ef: number;
  mods: string[];
  reg?: string[];
  ord: number;
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

  // ---- Next up: what can actually be started now ----------------------------
  // "Ready" = not started, in the current phase, and every in-scope dependency
  // is closed. Scoping to the current phase matters: a dependency-free Phase-4
  // activity is technically unblocked but is not what to do today.
  const inScopeIds = new Set(scoped.map((a) => a.id));
  const closed = (id: string) => status[id] === "Done" || status[id] === "N-A";
  const notStarted = (id: string) => !status[id] || status[id] === "Not started";
  const blockersOf = (a: Act) =>
    (a.depends || "")
      .split(",")
      .map((s) => s.trim())
      .filter((d) => d && d !== "-" && inScopeIds.has(d) && !closed(d));

  // current phase = the earliest phase that still has unfinished work
  const currentPhase =
    [1, 2, 3, 4].find((n) =>
      scoped.some((a) => a.phaseN === n && !closed(a.id)),
    ) ?? 4;

  const recommended = scoped
    .filter((a) => a.phaseN === currentPhase && notStarted(a.id))
    .sort((x, y) => x.wave - y.wave || x.ord - y.ord)
    .map((a) => ({ a, blockers: blockersOf(a) }));
  const readyList = recommended.filter((r) => !r.blockers.length);
  const blockedList = recommended.filter((r) => r.blockers.length);
  const nextUp = [...readyList.slice(0, 6), ...blockedList.slice(0, 2)];

  // workstream progress — the system you operate vs the dossier the NB reviews
  const wsRows = [
    { key: "qms", label: "Quality Management System", bar: "var(--t6)" },
    { key: "tf", label: "Technical File", bar: "var(--coral)" },
  ].map((w) => {
    const items = scoped.filter((a) => a.workstream === w.key);
    const d = items.filter((a) => status[a.id] === "Done").length;
    const t = items.filter((a) => status[a.id] !== "N-A").length;
    return { ...w, done: d, total: t, pct: t ? Math.round((d / t) * 100) : 0 };
  });

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

  // "Activities in scope" is already in the profile line above — this slot earns
  // its place better as the number that drives action.
  const kpis = [
    { l: "Implementation", v: pct + "%", s: "of applicable activities", accent: true },
    { l: "Ready to start", v: readyList.length, s: "no blockers — start today", hi: true },
    { l: "Done", v: done, s: "activities complete" },
    { l: "In progress", v: inprog, s: "activities underway" },
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
            <div className={"kv" + (k.hi ? " text-teal-600" : "")}>{k.v}</div>
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
                <div className="ph">
                  PHASE {p.n}
                  {p.n === currentPhase && (
                    <span className="ml-1.5 rounded-full bg-coral px-1.5 py-0.5 align-[1px] text-[9px] font-bold tracking-[0.08em] text-white">
                      YOU ARE HERE
                    </span>
                  )}
                </div>
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

      {nextUp.length > 0 && (
        <>
          <div className="sect-h">Next up</div>
          <p className="mb-2 text-[13px] text-muted">
            The recommended order for your device
            {readyList.length > 0 && (
              <>
                {" "}— <b className="text-teal-800">{readyList.length}</b>{" "}
                {readyList.length === 1 ? "has" : "have"} no blockers and can
                start today
              </>
            )}
            .
          </p>
          <div className="grid gap-4 lg:grid-cols-[1.9fr_1fr]">
            <div className="rounded-2xl border border-line bg-card px-2 py-1">
              {nextUp.map(({ a, blockers }) => {
                const isReady = blockers.length === 0;
                return (
                  <Link
                    key={a.id}
                    href={`/activity/${a.id}`}
                    className="flex items-center gap-3 rounded-lg border-t border-line px-2.5 py-3 transition first:border-t-0 hover:bg-cream/50"
                  >
                    <span
                      className={
                        "h-2 w-2 shrink-0 rounded-full " +
                        (isReady ? "bg-teal-600" : "bg-line")
                      }
                    />
                    <span
                      className={
                        "flex-1 text-[13.5px] font-medium " +
                        (isReady ? "text-teal-900" : "text-muted")
                      }
                    >
                      {a.statement.replace(/\.$/, "")}
                    </span>
                    <span className="hidden whitespace-nowrap font-mono text-[11px] text-muted sm:inline">
                      {a.id} · {a.dur}d
                    </span>
                    {isReady ? (
                      <span className="rounded-full bg-[#e3f2e9] px-2 py-0.5 text-[10.5px] font-bold text-[#17734e]">
                        Ready
                      </span>
                    ) : (
                      <span
                        className="max-w-[9rem] truncate rounded-full bg-cream2 px-2 py-0.5 text-[10.5px] font-semibold text-muted"
                        title={`Needs ${blockers.join(", ")}`}
                      >
                        Needs {blockers[0]}
                      </span>
                    )}
                  </Link>
                );
              })}
              {recommended.length > nextUp.length && (
                <Link
                  href={`/roadmap/${currentPhase}`}
                  className="block border-t border-line px-2.5 py-2.5 text-[12px] font-semibold text-coral transition hover:underline"
                >
                  See the full order for Phase {currentPhase} →
                </Link>
              )}
            </div>

            <div className="rounded-2xl border border-line bg-card p-4">
              {wsRows.map((w) => (
                <div key={w.key} className="mb-3.5 last:mb-0">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[13px] font-semibold text-teal-900">
                      {w.label}
                    </span>
                    <span className="font-mono text-[11.5px] text-muted">
                      {w.done} / {w.total}
                    </span>
                  </div>
                  <div className="pgbar mt-1.5">
                    <i style={{ width: w.pct + "%", background: w.bar }} />
                  </div>
                </div>
              ))}
              <p className="mt-3 text-[11.5px] leading-relaxed text-muted">
                The system you operate vs the dossier the Notified Body reviews —
                usually different people.
              </p>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
