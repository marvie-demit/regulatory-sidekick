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
  tier: "management" | "core" | "support";
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
  tier: PProc["tier"];
  standards: string[];
  cells: MatrixCell[]; // index 0..3 → phases 1..4
  docCount: number;
};

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
  let regulation = "MDR";
  const has = (m: string) => !!(profile && profile[m]);
  if (has("SW")) chars.add("software");
  if (has("AI")) chars.add("ai");
  if (has("IVD")) {
    chars.add("ivd");
    regulation = "IVDR";
  }
  if (has("SEC")) chars.add("security");
  if (has("PRIV")) chars.add("privacy");
  if (has("FDA")) markets.add("US-FDA");
  if (has("HW"))
    [
      "active",
      "sterile",
      "biocompatibility",
      "production",
      "metrology",
      "custom-made",
      "combination",
      "servicing",
    ].forEach((c) => chars.add(c));
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
