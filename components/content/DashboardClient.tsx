"use client";

import Link from "next/link";
import { useOrgState } from "@/components/app-shell/StateProvider";
import type { Phase, ModuleDef } from "@/lib/content/types";

type Act = {
  id: string;
  phaseN: number;
  qse: string;
  dur: number;
  es: number;
  ef: number;
  mods: string[];
};

const PC = ["var(--t5)", "var(--t6)", "var(--t8)", "var(--t9)"];

function fmtWk(d: number) {
  const w = Math.round((d / 5) * 10) / 10;
  return (w % 1 === 0 ? w : w.toFixed(1)) + " week" + (w === 1 ? "" : "s");
}

export function DashboardClient({
  phases,
  acts,
  qses,
  modules,
  docModules,
  totalDocs,
  critLen,
}: {
  phases: Phase[];
  acts: Act[];
  qses: string[];
  modules: ModuleDef[];
  docModules: string[];
  totalDocs: number;
  critLen: number;
}) {
  const { status, profile } = useOrgState();

  const inScopeAct = (a: Act) =>
    !profile ||
    !a.mods.length ||
    a.mods.indexOf("Core") >= 0 ||
    a.mods.some((m) => profile[m]);
  const inScopeDoc = (m: string) => !profile || m === "Core" || !!profile[m];

  const scoped = acts.filter(inScopeAct);

  let na = 0,
    done = 0,
    tot = 0;
  scoped.forEach((a) => {
    tot++;
    const s = status[a.id];
    if (s === "N-A") na++;
    else if (s === "Done") done++;
  });
  const base = tot - na;
  const pct = base ? Math.round((done / base) * 100) : 0;
  const pdays = scoped.length ? Math.max(...scoped.map((a) => a.ef)) : 0;
  const docsInScope = docModules.filter(inScopeDoc).length;
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
    { l: "Implementation", v: pct + "%", s: "overall completion", accent: true },
    {
      l: "Controlled documents",
      v: docsInScope,
      s: profile ? "in your scope" : "Core + optional modules",
    },
    {
      l: "Activities",
      v: actsInScope,
      s: profile ? "in your scope" : "across 4 phases",
    },
    { l: "Critical path", v: critLen, s: "activities to certification" },
    { l: "Est. timeline", v: fmtWk(pdays), s: pdays + " working days" },
  ];

  return (
    <main className="px-7 py-6">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-teal-900">
        Dashboard
      </h1>
      <p className="lead">
        Your Medical Device Stepwise Implementation - a lean, audit-ready IMS
        toward ISO 13485, EU MDR/IVDR, ISO 27001/42001 and GDPR, implemented
        step by step on the WHO LQSI model.
      </p>

      {profile ? (
        <div className="profbar on">
          <div className="pbi">
            <b>Profile:</b> Core
            {activeMods.length
              ? " · " + activeMods.map((m) => m.code).join(" · ")
              : " only"}{" "}
            — {docsInScope} of {totalDocs} documents · {actsInScope} of{" "}
            {acts.length} activities in scope
          </div>
          <Link className="btn ghost" href="/profile">
            Edit →
          </Link>
        </div>
      ) : (
        <div className="profbar">
          <div className="pbi">
            <b>Tailor this to your device.</b> Set a device profile and we scope
            the plan to the modules that apply - software, AI, IVD, hardware,
            security, privacy, FDA.
          </div>
          <Link className="btn" href="/profile">
            Set device profile →
          </Link>
        </div>
      )}

      <div className="leanprinciple">
        <span className="lpi">▲</span>
        <div>
          <b>Start lean, then evolve.</b> These are starting points to trim and
          grow, not binders to fill - ISO 13485 wants a QMS proportionate to
          your size and risk. Every activity shows its <b>minimum to start
          today</b> and how to mature it as your team, volume and risk grow.
        </div>
      </div>

      <div className="kpis">
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
          return (
            <Link
              key={p.n}
              href={`/roadmap/${p.n}`}
              className="pgcard"
              aria-label={`Phase ${p.n}: ${p.focus}, ${pg.done} of ${pg.total} done`}
            >
              <div className="bar" style={{ background: PC[i] }} />
              <div className="bd">
                <div className="ph">PHASE {p.n}</div>
                <h3>{p.focus}</h3>
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

      <div className="sect-h">The maturity model</div>
      <p className="lead" style={{ marginBottom: 8 }}>
        Each phase raises the organisation one level - from inspection up to a
        full quality-management system.
      </p>
      <Pyramid />

      <div className="sect-h">Work by essential</div>
      <div className="chips">
        {qses.map((q) => (
          <Link
            key={q}
            className="chip"
            href={`/checklist?qse=${encodeURIComponent(q)}`}
          >
            {q}
          </Link>
        ))}
      </div>
    </main>
  );
}

function Pyramid() {
  const W = 580,
    Hh = 330,
    pad = 12,
    cx = W / 2,
    baseW = 480,
    bY = Hh - 10,
    aY = pad,
    bh = (bY - aY) / 5;
  const lp = (t: number): [number, number] => [
    cx + (-baseW / 2) * t,
    aY + (bY - aY) * t,
  ];
  const rp = (t: number): [number, number] => [
    cx + (baseW / 2) * t,
    aY + (bY - aY) * t,
  ];
  const bands: [string, string, boolean][] = [
    ["Quality Management", "#5DCAA5", true],
    ["Quality System", "#1D9E75", false],
    ["Quality Assurance", "#1D6E62", false],
    ["Quality Control", "#16504A", false],
    ["Inspection", "#0F3B35", false],
  ];
  return (
    <div className="pyr">
      <svg
        viewBox={`0 0 ${W} ${Hh}`}
        width="100%"
        style={{ maxWidth: W }}
        role="img"
        aria-label="Maturity pyramid: five horizontal levels from Inspection at the base up to Quality Management at the apex. The four implementation phases cut diagonally across these levels as curved boundaries, so each phase overlaps parts of several maturity levels."
      >
        {bands.map((b, k) => {
          const yT = aY + k * bh,
            yB = aY + (k + 1) * bh,
            tT = (yT - aY) / (bY - aY),
            tB = (yB - aY) / (bY - aY);
          const Lt = lp(tT),
            Rt = rp(tT),
            Lb = lp(tB),
            Rb = rp(tB);
          const pts = [Lt, Rt, Rb, Lb].map((p) => p[0] + "," + p[1]).join(" ");
          const tc = b[2] ? "#04342C" : "#ffffff",
            my = (yT + yB) / 2;
          return (
            <g key={k}>
              <polygon
                points={pts}
                fill={b[1]}
                stroke="rgba(255,255,255,.5)"
                strokeWidth={1}
              />
              {k === 0 ? (
                <>
                  <text
                    x={cx}
                    y={yB - 19}
                    textAnchor="middle"
                    fontSize={10.5}
                    fontWeight={700}
                    fill={tc}
                  >
                    Quality
                  </text>
                  <text
                    x={cx}
                    y={yB - 6}
                    textAnchor="middle"
                    fontSize={10.5}
                    fontWeight={700}
                    fill={tc}
                  >
                    Management
                  </text>
                </>
              ) : (
                <text
                  x={cx}
                  y={my + 4}
                  textAnchor="middle"
                  fontSize={13.5}
                  fontWeight={700}
                  fill={tc}
                >
                  {b[0]}
                </text>
              )}
            </g>
          );
        })}
        {([
          [0.73, 0.92],
          [0.515, 0.71],
          [0.305, 0.5],
        ] as [number, number][]).map((d, i) => {
          const L = lp(d[0]),
            R = rp(d[1]),
            mx = (L[0] + R[0]) / 2,
            my = (L[1] + R[1]) / 2 + 18;
          return (
            <path
              key={i}
              d={`M ${L[0]} ${L[1]} Q ${mx} ${my} ${R[0]} ${R[1]}`}
              fill="none"
              stroke="#ffffff"
              strokeWidth={2.4}
              strokeLinecap="round"
              opacity={0.92}
            />
          );
        })}
        {[0.84, 0.62, 0.41, 0.2].map((t, i) => {
          const P = lp(t);
          return (
            <g key={i}>
              <line
                x1={P[0] - 2}
                y1={P[1]}
                x2={P[0] - 11}
                y2={P[1]}
                stroke="#993c1d"
                strokeWidth={1.4}
              />
              <text
                x={P[0] - 15}
                y={P[1] + 4}
                textAnchor="end"
                fontSize={12.5}
                fontWeight={800}
                fill="#993c1d"
              >
                Phase {i + 1}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
