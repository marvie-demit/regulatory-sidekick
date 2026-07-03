"use client";

import Link from "next/link";
import { useState } from "react";
import { useOrgState } from "@/components/app-shell/StateProvider";
import { stcls } from "@/components/content/StatusDropdown";
import { hasFullAccess, SAMPLE_ACTIVITY_ID } from "@/lib/auth/access";
import { actInScope } from "@/lib/content/scope";

// Start-order grid: rows are processes, columns are the recommended start order
// (the model's per-phase dependency wave, re-ranked 1..k for the visible profile).
// A step sits in the column it should be tackled, so a column reads top-to-bottom
// across every process; gaps mean the process has nothing at that order. A lane
// line runs from the process pill through its cards (across gaps) so a process
// stays legible even when its steps are far apart. Replaces the old process tree.

export type TAct = {
  id: string;
  statement: string;
  proc: string;
  procName: string;
  tier: string;
  dur: number;
  mods: string[];
  reg?: string[];
  depends: string;
  wave: string; // "W1".."Wn" — per-phase dependency level
};

const TIERS: { key: string; label: string }[] = [
  { key: "management", label: "Management & steering" },
  { key: "core", label: "Core realization" },
  { key: "support", label: "Support & enabling" },
];

const GUTTER = 168; // sticky process-label column
const COLW = 134; // each start-order column
const STROKE = "#9fbdb5";

export function RoadmapGrid({
  acts,
  critSet,
  plan,
}: {
  acts: TAct[];
  critSet: Record<string, number>;
  plan?: string;
}) {
  const { status, profile } = useOrgState();
  const full = hasFullAccess(plan);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const vis = acts.filter((a) => actInScope(a, profile));

  // per-phase dependency wave -> contiguous start-order rank 1..k for this profile
  const waveNum = (a: TAct) => parseInt(a.wave.slice(1), 10) || 1;
  const presentWaves = Array.from(new Set(vis.map(waveNum))).sort((x, y) => x - y);
  const rankOf: Record<number, number> = {};
  presentWaves.forEach((w, i) => (rankOf[w] = i + 1));
  const maxRank = presentWaves.length || 1;
  const rankFor = (a: TAct) => rankOf[waveNum(a)] || 1;

  const order: string[] = [];
  const groups: Record<string, TAct[]> = {};
  vis.forEach((a) => {
    if (!groups[a.proc]) {
      groups[a.proc] = [];
      order.push(a.proc);
    }
    groups[a.proc].push(a);
  });
  const minRank = (p: string) => Math.min(...groups[p].map(rankFor));

  const cols = Array.from({ length: maxRank }, (_, i) => i + 1);
  const gridW = GUTTER + maxRank * COLW;

  const Card = ({ a }: { a: TAct }) => {
    const crit = critSet[a.id];
    const cls = stcls(status[a.id] || "");
    const locked = !full && a.id !== SAMPLE_ACTIVITY_ID;
    const inner = (
      <>
        <div className="flex items-start gap-1.5">
          {!locked && <span className={"pdot mt-1" + (cls ? " " + cls : "")} />}
          <span className="line-clamp-2 text-[11px] font-medium leading-snug text-teal-900">
            {a.statement}
          </span>
        </div>
        <div className="mt-1 text-[10px] text-muted">
          {a.id} · {a.dur}d{crit ? " · critical" : ""}
          {locked ? " · locked" : ""}
        </div>
      </>
    );
    const base = "block rounded-lg border bg-card px-2 py-1.5 transition";
    return locked ? (
      <Link
        href="/pricing"
        className={`${base} border-line opacity-70 hover:border-coral`}
        title={a.statement}
        aria-label={`${a.statement} (${a.id}) — locked`}
      >
        {inner}
      </Link>
    ) : (
      <Link
        href={`/activity/${a.id}`}
        className={`${base} ${crit ? "border-coral" : "border-line"} hover:border-teal-700`}
        title={a.statement}
        aria-label={`${a.statement} (${a.id})${crit ? " — critical path" : ""}`}
      >
        {inner}
      </Link>
    );
  };

  const Lane = ({ proc }: { proc: string }) => {
    const kids = groups[proc];
    const byCol: Record<number, TAct[]> = {};
    kids.forEach((a) => {
      const r = rankFor(a);
      (byCol[r] = byCol[r] || []).push(a);
    });
    const maxC = Math.max(...Object.keys(byCol).map(Number));
    const lineW = (maxC - 1) * COLW + COLW / 2; // pill edge → last card centre, across gaps
    return (
      <div className="flex items-stretch border-b border-line/70">
        <div
          className="sticky left-0 z-20 flex flex-none items-center bg-bg pr-2"
          style={{ width: GUTTER }}
        >
          <div className="w-full rounded-xl border-2 border-teal-800 bg-teal-800 px-3 py-2 text-white">
            <div className="text-[11.5px] font-semibold leading-snug">
              {kids[0].procName}
            </div>
            <div className="mt-0.5 text-[9px] uppercase tracking-wide text-teal-100/80">
              {kids.length} {kids.length === 1 ? "step" : "steps"}
            </div>
          </div>
        </div>
        <div className="relative flex flex-none" style={{ width: maxRank * COLW }}>
          <div
            className="pointer-events-none absolute top-1/2 h-0.5 -translate-y-1/2"
            style={{ left: 0, width: lineW, background: STROKE }}
            aria-hidden
          />
          {cols.map((c) => (
            <div
              key={c}
              className="flex flex-none flex-col justify-center gap-2 border-l border-dashed border-line px-1.5 py-2"
              style={{ width: COLW }}
            >
              {(byCol[c] || []).map((a) => (
                <div key={a.id} className="relative z-10">
                  <Card a={a} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-lg border border-line bg-card px-3 py-2 text-[10px] leading-relaxed text-muted">
        Rows are processes; columns are the recommended start order. A card sits in
        the column you tackle it — so a column reads down across every process, and
        gaps mean the process has nothing at that order.{" "}
        <span style={{ color: "#993c1d" }}>Coral</span> marks the critical path;
        scroll sideways for later steps.
      </div>
      <div className="overflow-x-auto pb-3">
        <div style={{ minWidth: gridW }}>
          <div className="flex items-end">
            <div
              className="sticky left-0 z-20 flex flex-none items-end bg-bg pb-1"
              style={{ width: GUTTER }}
            >
              <span className="text-[10px] text-muted">Start order →</span>
            </div>
            <div className="flex flex-none" style={{ width: maxRank * COLW }}>
              {cols.map((c) => (
                <div
                  key={c}
                  className="flex-none border-l border-dashed border-line py-1 text-center text-[11px] font-semibold text-teal-800"
                  style={{ width: COLW }}
                >
                  {c}
                </div>
              ))}
            </div>
          </div>

          {TIERS.map((tier) => {
            const procs = order
              .filter((p) => groups[p][0].tier === tier.key)
              .sort(
                (a, b) => minRank(a) - minRank(b) || order.indexOf(a) - order.indexOf(b),
              );
            if (!procs.length) return null;
            const isOpen = !collapsed[tier.key];
            const stepCount = procs.reduce((n, p) => n + groups[p].length, 0);
            return (
              <div key={tier.key}>
                <button
                  type="button"
                  onClick={() =>
                    setCollapsed((c) => ({ ...c, [tier.key]: !c[tier.key] }))
                  }
                  aria-expanded={isOpen}
                  className="sticky left-0 z-20 mt-3 mb-1 flex items-center gap-2 bg-bg py-1 pr-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-teal-800 transition hover:text-teal-950"
                >
                  <span className="text-[9px]">{isOpen ? "▾" : "▸"}</span>
                  {tier.label}
                  <span className="font-normal normal-case tracking-normal text-muted">
                    {procs.length} process{procs.length === 1 ? "" : "es"} ·{" "}
                    {stepCount} step{stepCount === 1 ? "" : "s"}
                  </span>
                </button>
                {isOpen && procs.map((p) => <Lane key={p} proc={p} />)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
