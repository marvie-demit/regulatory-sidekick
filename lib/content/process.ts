// Server-only loader for process-model.json + the views the Process Map needs.
// Types + profile scoping live in process-scope.ts (client-safe, no fs).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ProcessModel, MatrixRow, MatrixCell } from "./process-scope";

export type { PStep, PProc, ProcessModel, MatrixRow, MatrixCell } from "./process-scope";

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

const TIER_ORDER: Record<string, number> = { management: 0, core: 1, support: 2 };

// One row per process, cells grouped by phase (1..4).
export function phaseMatrix(): MatrixRow[] {
  const m = getProcessModel();
  return m.processes
    .slice()
    .sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier])
    .map((p) => {
      const cells: MatrixCell[] = [
        { steps: [] },
        { steps: [] },
        { steps: [] },
        { steps: [] },
      ];
      let docCount = 0;
      p.steps.forEach((s) => {
        if (s.phase >= 1 && s.phase <= 4) cells[s.phase - 1].steps.push(s);
        docCount += s.produces.length;
      });
      return {
        id: p.id,
        name: p.name,
        tier: p.tier,
        standards: p.standards,
        cells,
        docCount,
      };
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
