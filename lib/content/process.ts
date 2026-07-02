// Loads process-model.json (the two-axis process model) and derives the views
// the Process Map page renders: the process landscape (by tier) and the
// phase-overlap matrix (process × phase → steps, with maturity).
import { readFileSync } from "node:fs";
import { join } from "node:path";

export type PStep = {
  id: string;
  title: string;
  phase: number;
  maturity: string;
  appliesWhen: {
    regulation?: string[];
    characteristics?: string[];
    markets?: string[];
  };
  produces: string[];
  consumes: string[];
  handoffTo: string[];
};
export type PProc = {
  id: string;
  name: string;
  tier: "management" | "core" | "support";
  standards: string[];
  steps: PStep[];
};
export type ProcessModel = {
  version: string;
  phases: Record<string, string>;
  processes: PProc[];
};

let _pm: ProcessModel | null = null;
export function getProcessModel(): ProcessModel {
  if (_pm) return _pm;
  try {
    _pm = JSON.parse(
      readFileSync(join(process.cwd(), "content", "process-model.json"), "utf-8"),
    ) as ProcessModel;
    return _pm;
  } catch {
    return { version: "", phases: {}, processes: [] };
  }
}

export const PHASE_LABELS: Record<number, string> = {
  1: "Operate safely",
  2: "Control & trace",
  3: "Govern & lead",
  4: "Improve & certify",
};

export const TIERS: { key: PProc["tier"]; label: string }[] = [
  { key: "management", label: "Management & steering" },
  { key: "core", label: "Core realization" },
  { key: "support", label: "Support & enabling" },
];

export type MatrixCell = { steps: PStep[] };
export type MatrixRow = {
  id: string;
  name: string;
  tier: PProc["tier"];
  standards: string[];
  cells: MatrixCell[]; // index 0..3 → phases 1..4
  docCount: number;
};

// One row per process, cells grouped by phase (1..4).
export function phaseMatrix(): MatrixRow[] {
  const m = getProcessModel();
  const order = { management: 0, core: 1, support: 2 };
  return m.processes
    .slice()
    .sort((a, b) => order[a.tier] - order[b.tier])
    .map((p) => {
      const cells: MatrixCell[] = [{ steps: [] }, { steps: [] }, { steps: [] }, { steps: [] }];
      let docCount = 0;
      p.steps.forEach((s) => {
        if (s.phase >= 1 && s.phase <= 4) cells[s.phase - 1].steps.push(s);
        docCount += s.produces.length;
      });
      return { id: p.id, name: p.name, tier: p.tier, standards: p.standards, cells, docCount };
    });
}

export function modelStats() {
  const m = getProcessModel();
  const steps = m.processes.reduce((s, p) => s + p.steps.length, 0);
  const docs = m.processes.reduce(
    (s, p) => s + p.steps.reduce((x, st) => x + st.produces.length, 0),
    0,
  );
  return { processes: m.processes.length, steps, docs };
}

// Maturity → a tint level (1 lightest … 4 strongest) for the matrix cells.
export const MATURITY_TINT: Record<string, number> = {
  lean: 1,
  full: 2,
  govern: 3,
  sustain: 4,
};
