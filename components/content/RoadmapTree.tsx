"use client";

import Link from "next/link";
import { useState } from "react";
import { useOrgState } from "@/components/app-shell/StateProvider";
import { stcls } from "@/components/content/StatusDropdown";
import { hasFullAccess, SAMPLE_ACTIVITY_ID } from "@/lib/auth/access";
import { actInScope } from "@/lib/content/scope";

// LQSI-style roadmap: each process is a parent branch; its steps in this phase
// flow LEFT→RIGHT along their dependency chain (DEV.inputs → verify → validate),
// branching where a step fans out — like the WHO LQSI phase trees. Every step
// hangs off a labelled parent, so nothing floats.

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
};

const TIERS: { key: string; label: string }[] = [
  { key: "management", label: "Management & steering" },
  { key: "core", label: "Core realization" },
  { key: "support", label: "Support & enabling" },
];

// geometry (Connector maths depends on these) — compact so deep chains fit
const CH = 50; // card height
const GAP = 10; // vertical gap between sibling subtrees
const CW = 198; // card width
const CONN = 34; // connector width
const PILLW = 162;
const STROKE = "#9fbdb5";

type LNode = { act: TAct | null; children: LNode[]; h: number };

// Build a left→right tree for one process group: parent = the same-group
// dependency with the greatest depth (extra in-edges are dropped — a tree, not
// a DAG, is what keeps it readable; the Process Map shows the full graph).
function buildGroupTree(kids: TAct[]): LNode {
  const ids = new Set(kids.map((k) => k.id));
  const preds: Record<string, string[]> = {};
  kids.forEach((k) => {
    preds[k.id] =
      k.depends && k.depends !== "-"
        ? k.depends
            .split(",")
            .map((s) => s.trim())
            .filter((t) => ids.has(t))
        : [];
  });
  const depth: Record<string, number> = {};
  const stack = new Set<string>();
  const d = (id: string): number => {
    if (depth[id] !== undefined) return depth[id];
    if (stack.has(id)) return 0; // cycle guard
    stack.add(id);
    const ps = preds[id];
    depth[id] = ps.length ? 1 + Math.max(...ps.map(d)) : 0;
    stack.delete(id);
    return depth[id];
  };
  kids.forEach((k) => d(k.id));

  const childrenOf: Record<string, TAct[]> = {};
  const roots: TAct[] = [];
  kids.forEach((k) => {
    const ps = preds[k.id];
    if (!ps.length) {
      roots.push(k);
      return;
    }
    let best = ps[0];
    ps.forEach((p) => {
      if (depth[p] > depth[best]) best = p;
    });
    (childrenOf[best] = childrenOf[best] || []).push(k);
  });

  const mk = (a: TAct | null, ch: TAct[]): LNode => {
    const children = ch.map((c) => mk(c, childrenOf[c.id] || []));
    const H = children.length
      ? children.reduce((s, c) => s + c.h, 0) + GAP * (children.length - 1)
      : 0;
    return { act: a, children, h: Math.max(CH, H) };
  };
  return mk(null, roots);
}

// Elbow bracket from a parent (vertical centre) to each child subtree's centre.
function Conn({ h, ys }: { h: number; ys: number[] }) {
  const py = h / 2;
  const bus = 16;
  const single = ys.length === 1 && Math.abs(ys[0] - py) < 1;
  return (
    <svg
      width={CONN}
      height={h}
      viewBox={`0 0 ${CONN} ${h}`}
      style={{ flex: "0 0 auto" }}
      aria-hidden
    >
      {single ? (
        <path d={`M0 ${py} H${CONN}`} fill="none" stroke={STROKE} strokeWidth={2} />
      ) : (
        <>
          <path d={`M0 ${py} H${bus}`} fill="none" stroke={STROKE} strokeWidth={2} />
          <path
            d={`M${bus} ${Math.min(py, ys[0])} V${Math.max(py, ys[ys.length - 1])}`}
            fill="none"
            stroke={STROKE}
            strokeWidth={2}
          />
          {ys.map((y, i) => (
            <path
              key={i}
              d={`M${bus} ${y} H${CONN}`}
              fill="none"
              stroke={STROKE}
              strokeWidth={2}
            />
          ))}
        </>
      )}
    </svg>
  );
}

export function RoadmapTree({
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
  // collapsible tiers — all expanded by default (consistent), user collapses any
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const vis = acts.filter((a) => actInScope(a, profile));

  const order: string[] = [];
  const groups: Record<string, TAct[]> = {};
  vis.forEach((a) => {
    if (!groups[a.proc]) {
      groups[a.proc] = [];
      order.push(a.proc);
    }
    groups[a.proc].push(a);
  });

  const Card = ({ a }: { a: TAct }) => {
    const crit = critSet[a.id];
    const cls = stcls(status[a.id] || "");
    const locked = !full && a.id !== SAMPLE_ACTIVITY_ID;
    const inner = (
      <>
        <div className="flex items-center gap-1.5">
          {!locked && <span className={"pdot" + (cls ? " " + cls : "")} />}
          <span className="line-clamp-2 text-[11px] font-medium leading-snug text-teal-900">
            {a.statement}
          </span>
        </div>
        <div className="mt-0.5 text-[9px] text-muted">
          {a.id} · {a.dur}d{crit ? " · critical" : ""}
          {locked ? " · locked" : ""}
        </div>
      </>
    );
    const base =
      "flex flex-col justify-center rounded-lg border bg-card px-2.5 py-1.5 transition";
    const style = { width: CW, height: CH } as const;
    return locked ? (
      <Link
        href="/pricing"
        className={`${base} border-line opacity-70 hover:border-coral`}
        style={style}
        title={a.statement}
        aria-label={`${a.statement} (${a.id}) — locked`}
      >
        {inner}
      </Link>
    ) : (
      <Link
        href={`/activity/${a.id}`}
        className={`${base} ${crit ? "border-coral" : "border-line"} hover:border-teal-700`}
        style={style}
        title={a.statement}
        aria-label={`${a.statement} (${a.id})${crit ? " — critical path" : ""}`}
      >
        {inner}
      </Link>
    );
  };

  // recursive left→right subtree: [card | bracket | children column]
  const Sub = ({ node }: { node: LNode }) => {
    const ys: number[] = [];
    let acc = 0;
    node.children.forEach((c) => {
      ys.push(acc + c.h / 2);
      acc += c.h + GAP;
    });
    return (
      <div className="flex" style={{ height: node.h }}>
        <div className="flex items-center" style={{ height: node.h }}>
          {node.act ? <Card a={node.act} /> : null}
        </div>
        {node.children.length > 0 && <Conn h={node.h} ys={ys} />}
        {node.children.length > 0 && (
          <div className="flex flex-col" style={{ gap: GAP }}>
            {node.children.map((c) => (
              <Sub key={c.act ? c.act.id : "root"} node={c} />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      {TIERS.map((tier) => {
        const procs = order.filter((p) => groups[p][0].tier === tier.key);
        if (!procs.length) return null;
        const isOpen = !collapsed[tier.key];
        const stepCount = procs.reduce((n, p) => n + groups[p].length, 0);
        return (
          <section key={tier.key}>
            <button
              type="button"
              onClick={() =>
                setCollapsed((c) => ({ ...c, [tier.key]: !c[tier.key] }))
              }
              aria-expanded={isOpen}
              className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-teal-800 transition hover:text-teal-950"
            >
              <span className="text-[9px]">{isOpen ? "▾" : "▸"}</span>
              {tier.label}
              <span className="font-normal normal-case tracking-normal text-muted">
                {procs.length} process{procs.length === 1 ? "" : "es"} ·{" "}
                {stepCount} step{stepCount === 1 ? "" : "s"}
              </span>
            </button>
            {!isOpen ? null : (
            <div className="gwrap pr-6">
              <div className="flex flex-col gap-4">
                {procs.map((p) => {
                  const kids = groups[p];
                  const tree = buildGroupTree(kids);
                  const ys: number[] = [];
                  let acc = 0;
                  tree.children.forEach((c) => {
                    ys.push(acc + c.h / 2);
                    acc += c.h + GAP;
                  });
                  return (
                    <div
                      key={p}
                      className="flex items-center"
                      style={{ minHeight: tree.h }}
                    >
                      <div className="flex items-center self-stretch">
                        <div
                          className="flex-none rounded-xl border-2 border-teal-800 bg-teal-800 px-3 py-2 text-white"
                          style={{ width: PILLW }}
                        >
                          <div className="text-[11.5px] font-semibold leading-snug">
                            {kids[0].procName}
                          </div>
                          <div className="mt-0.5 text-[9px] uppercase tracking-wide text-teal-100/80">
                            {kids.length} {kids.length === 1 ? "step" : "steps"}
                          </div>
                        </div>
                      </div>
                      <Conn h={tree.h} ys={ys} />
                      <div className="flex flex-col" style={{ gap: GAP }}>
                        {tree.children.map((c) => (
                          <Sub key={c.act ? c.act.id : "r"} node={c} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
