// Types for the generated content.json (single source of content truth,
// produced by the Python pipeline at NotJustAnyQMS/_Project/_lib/build_site.py).

export type Step = { t: string; d: string };
export type Group = { role: string; steps: Step[] };
export type ClauseMap = { std: string; refs: string[] };

export type SubActivity = {
  t: string;
  who: string;
  why: string;
  what: string;
  how: Step[];
  refs?: string[];
  clauses?: ClauseMap[];
  docs?: string;
};

export type Activity = {
  id: string;
  phase: string; // "P1".."P4"
  wave: string; // "W1".."W5"
  qse: string;
  statement: string;
  why?: string;
  what?: string;
  how2?: Group[];
  clausemap?: ClauseMap[];
  clause?: string;
  records?: string[];
  tips?: string[];
  lean?: { start: string; evolve: string } | null;
  mods?: string[];
  reg?: string[]; // regulatory route: ["MDR"] | ["IVDR"] | ["MDR","IVDR"] | [] (common)
  documents?: string;
  depends?: string;
  leads?: string;
  subs?: SubActivity[];
  dur?: number;
  es?: number;
  ef?: number;
  deep?: number;
  mod?: string; // present on profile-scoped module activities
};

export type DocItem = {
  id: string;
  title: string;
  cls: string; // SOP | WI | TPL | FOR | LIS | POL | MAN
  domain: string;
  module: string;
  reg?: string[]; // regulatory route of the producing step (for library scoping)
  status?: string;
  page?: boolean;
};

export type Phase = { n: number; focus: string };
export type ModuleDef = { code: string; label: string; q?: string; std?: string };
export type Question = { q: string; a: string[]; c: number; e?: string };

export type Standard = {
  std: string;
  phaseActs: Record<string, string[]>; // { P1:[ids], P2:[...], ... }
  clauses: { c: string; acts: Record<string, string[]> }[];
};

export type Content = {
  phases: Phase[];
  qses: string[];
  activities: Activity[];
  documents: DocItem[];
  questions: Record<string, Question[]>;
  standards: Standard[];
  modules: ModuleDef[];
  modCounts: Record<string, number>;
  docActs: Record<string, string[]>;
  procs?: Record<string, unknown>;
  procOrder?: string[];
  projectDays: number;
  stats: { docs: number; activities: number; examples?: number };
};

// device profile: null = unconfigured (show everything); object = active module codes
export type Profile = Record<string, number> | null;
