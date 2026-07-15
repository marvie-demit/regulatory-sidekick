// Client-safe process-model types + profile scoping (NO node:fs, so this is
// importable from client components). The fs loader lives in process.ts.

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
  workstream: "qms" | "tf";
  standards: string[];
  steps: PStep[];
};
export type ProcessModel = {
  version: string;
  phases: Record<string, string>;
  processes: PProc[];
};
export type MatrixCell = { steps: PStep[] };
export type MatrixRow = {
  id: string;
  name: string;
  workstream: PProc["workstream"];
  standards: string[];
  cells: MatrixCell[]; // index 0..3 → phases 1..4
  docCount: number;
};

export const PHASE_LABELS: Record<number, string> = {
  1: "Set the foundations",
  2: "Develop under control",
  3: "Verify, validate & make",
  4: "Certify, launch & operate",
};

export const WORKSTREAMS: { key: PProc["workstream"]; label: string }[] = [
  { key: "qms", label: "Quality Management System" },
  { key: "tf", label: "Technical File" },
];

export const MATURITY_STYLE: Record<string, string> = {
  lean: "text-teal-600",
  full: "text-teal-700",
  govern: "text-coral",
  sustain: "text-coral",
};

export type Scope = {
  regulation: string;
  characteristics: string[];
  markets: string[];
};

// Map the app's device profile (module codes: SW/AI/IVD/SEC/PRIV/HW/FDA) to the
// model's scope predicate (regulation + fine characteristics + markets). Lossy
// by nature — the profile can't express, say, sterile-vs-active within HW — so
// HW switches on all hardware device-type characteristics.
export function profileToScope(profile: Record<string, unknown> | null): Scope {
  const chars = new Set<string>();
  const markets = new Set<string>(["EU"]);
  const has = (m: string) => !!(profile && profile[m]);
  // EU route: explicit MDR/IVDR wins; an IVD device implies IVDR; default MDR.
  const regulation = has("IVDR") || has("IVD") ? "IVDR" : "MDR";
  if (has("SW")) chars.add("software");
  if (has("AI")) chars.add("ai");
  if (regulation === "IVDR") chars.add("ivd");
  if (has("SEC")) chars.add("security");
  if (has("PRIV")) chars.add("privacy");
  if (has("FDA")) markets.add("US-FDA");
  // Physical/hardware base — the characteristics common to any manufactured
  // device. "active" and "sterile" are split out into their own toggles below.
  if (has("HW"))
    [
      "biocompatibility",
      "production",
      "metrology",
      "custom-made",
      "combination",
      "servicing",
    ].forEach((c) => chars.add(c));
  if (has("ACT")) chars.add("active"); // active / electrical device (IEC 60601)
  if (has("STE")) chars.add("sterile"); // supplied sterile
  return { regulation, characteristics: [...chars], markets: [...markets] };
}

export function stepApplies(aw: PStep["appliesWhen"], scope: Scope): boolean {
  if (aw.regulation && !aw.regulation.includes(scope.regulation)) return false;
  if (
    aw.characteristics &&
    !aw.characteristics.some((c) => scope.characteristics.includes(c))
  )
    return false;
  if (aw.markets && !aw.markets.some((m) => scope.markets.includes(m)))
    return false;
  return true;
}
