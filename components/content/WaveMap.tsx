"use client";

import Link from "next/link";
import { useOrgState } from "@/components/app-shell/StateProvider";
import { stcls } from "@/components/content/StatusDropdown";
import { hasFullAccess, SAMPLE_ACTIVITY_ID } from "@/lib/auth/access";
import { actInScope } from "@/lib/content/scope";

type WAct = {
  id: string;
  statement: string;
  wave: string;
  dur: number;
  mods: string[];
  reg?: string[];
  ord: number;
};

// geometry — identical to the original roadmap() in build_site.py
const nodeW = 210;
const nodeH = 86;
const colW = 274;
const rowH = 106;
const padX = 18;
const padY = 44;

const wave = (w?: string) =>
  (parseInt((w || "W1").replace(/\D/g, ""), 10) || 1) - 1;

// Structured orthogonal connector (rounded elbow) instead of a bezier curve:
// out of the source, down/up the inter-column gutter, into the target.
function edgePath(x1: number, y1: number, x2: number, y2: number): string {
  if (Math.abs(y1 - y2) < 1) return `M${x1} ${y1} H${x2}`;
  const midX = x1 + Math.max(22, (x2 - x1) / 2);
  const dir = y2 > y1 ? 1 : -1;
  const r = Math.max(
    0,
    Math.min(10, Math.abs(y2 - y1) / 2, midX - x1, x2 - midX),
  );
  return `M${x1} ${y1} H${midX - r} Q${midX} ${y1} ${midX} ${y1 + dir * r} V${y2 - dir * r} Q${midX} ${y2} ${midX + r} ${y2} H${x2}`;
}

export function WaveMap({
  acts,
  edges,
  critSet,
  crite,
  plan,
}: {
  acts: WAct[];
  edges: [string, string][];
  critSet: Record<string, number>;
  crite: Record<string, number>;
  plan?: string;
}) {
  const { status, profile } = useOrgState();

  const full = hasFullAccess(plan);
  const vis = acts.filter((a) => actInScope(a, profile));
  const inSet: Record<string, 1> = {};
  vis.forEach((a) => (inSet[a.id] = 1));
  const inEdges = edges.filter(([u, v]) => inSet[u] && inSet[v]);

  const cols: Record<number, WAct[]> = {};
  vis.forEach((a) => {
    const c = wave(a.wave);
    (cols[c] = cols[c] || []).push(a);
  });
  const ckeys = Object.keys(cols)
    .map(Number)
    .sort((a, b) => a - b);
  ckeys.forEach((c) => cols[c].sort((x, y) => x.ord - y.ord));

  const maxCol = ckeys[ckeys.length - 1] ?? 0;
  let maxRows = 0;
  ckeys.forEach((c) => {
    if (cols[c].length > maxRows) maxRows = cols[c].length;
  });

  const pos: Record<string, { x: number; y: number }> = {};
  ckeys.forEach((c) =>
    cols[c].forEach((a, i) => {
      pos[a.id] = { x: padX + c * colW, y: padY + i * rowH };
    }),
  );

  const W = padX * 2 + maxCol * colW + nodeW;
  const H = padY + maxRows * rowH - (rowH - nodeH) + 16;

  return (
    <div className="gwrap">
      <div className="pcanvas" style={{ width: W, height: H }}>
        {ckeys.map((c) => (
          <div
            key={`lane-${c}`}
            className="rmlane"
            style={{
              left: padX + c * colW - 12,
              top: 34,
              width: nodeW + 24,
              height: H - 40,
            }}
          />
        ))}

        <svg
          className="rmedges"
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          aria-hidden
        >
          {inEdges.map(([u, v]) => {
            const a = pos[u];
            const b = pos[v];
            if (!a || !b) return null;
            const crit = crite[`${u}>${v}`];
            const x1 = a.x + nodeW;
            const y1 = a.y + nodeH / 2;
            const x2 = b.x;
            const y2 = b.y + nodeH / 2;
            return (
              <path
                key={`${u}>${v}`}
                d={edgePath(x1, y1, x2, y2)}
                fill="none"
                stroke={crit ? "#D8593A" : "#b3c8c1"}
                strokeWidth={crit ? 2.6 : 1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            );
          })}
        </svg>

        {ckeys.map((c) => (
          <div
            key={`head-${c}`}
            className="rmhead"
            style={{ left: padX + c * colW, top: 8, width: nodeW }}
          >
            Wave {c + 1}
          </div>
        ))}

        {vis.map((a) => {
          const p = pos[a.id];
          const crit = critSet[a.id];
          const cls = stcls(status[a.id] || "");
          const locked = !full && a.id !== SAMPLE_ACTIVITY_ID;
          if (locked) {
            return (
              <Link
                key={a.id}
                href="/pricing"
                className="pnode locked"
                style={{
                  left: p.x,
                  top: p.y,
                  width: nodeW,
                  height: nodeH,
                }}
                aria-label={`${a.statement} (${a.id}) — locked, purchase for full access`}
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#9aa39d"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ position: "absolute", top: 9, right: 11 }}
                  aria-hidden="true"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <span className="pt">{a.statement}</span>
                <span className="pn">
                  {a.id} · {a.dur}d · locked
                </span>
              </Link>
            );
          }
          return (
            <Link
              key={a.id}
              href={`/activity/${a.id}`}
              className={`pnode${crit ? " crit" : ""}`}
              style={{ left: p.x, top: p.y, width: nodeW, height: nodeH }}
              aria-label={`${a.statement} (${a.id})${crit ? " — critical path" : ""}`}
            >
              <span className={"pdot" + (cls ? " " + cls : "")} />
              <span className="pt">{a.statement}</span>
              <span className="pn">
                {a.id} · {a.dur}d{crit ? " · critical" : ""}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
