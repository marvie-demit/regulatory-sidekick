// The free readiness self-assessment — question set, answer shape and result
// shape. Rung 1 of the ladder in BUSINESS-MODEL.md §3.
//
// PURE ON PURPOSE, for the same reason lib/startup/application.ts is: the client
// questionnaire imports the option tables from here, so a server-only import in
// this file would drag content.json and node:fs into the browser bundle. The
// scoring lives in ./score.ts, which is the half that reads the corpus.
//
// WHERE THE QUESTIONS COME FROM. None of this is invented. Every question maps
// onto something the corpus already models, which is what makes the score mean
// anything:
//
//   • the regulatory route and the device characteristics are the device profile
//     (content.modules + lib/content/scope.ts) — the same two axes that scope
//     the roadmap and the library for a paying customer;
//   • the four phases are content.phases;
//   • the twelve core processes are the twelve QSEs (content.qses), each
//     anchored on the specific activity that establishes it — the set
//     BUSINESS-MODEL.md §3 calls "the 12 QSEs / core processes needed to survive
//     a notified-body Stage 1 audit";
//   • the notified-body ladder is activity TEF.nb, whose own lead-time figures
//     (~3 months to contract, ~9 months to review) drive the timeline verdict.
//
// So a gap in the output is always a named activity with a named first step,
// never a generic "you should have a QMS".

export const SCORER_VERSION = "1";

// ---------------------------------------------------------------------------
// Q1 — the EU regulatory route. Mutually exclusive, exactly as euRoute() in
// lib/content/scope.ts treats it.
// ---------------------------------------------------------------------------
export const ROUTES = ["MDR", "IVDR", "undecided", "FDA"] as const;
export type Route = (typeof ROUTES)[number];

export const ROUTE_OPTIONS: { value: Route; label: string; hint: string }[] = [
  {
    value: "MDR",
    label: "EU MDR",
    hint: "A medical device under Regulation (EU) 2017/745.",
  },
  {
    value: "IVDR",
    label: "EU IVDR",
    hint: "An in-vitro diagnostic under Regulation (EU) 2017/746.",
  },
  {
    value: "FDA",
    label: "US (FDA) first",
    hint: "The US market is the first target; EU conformity comes later.",
  },
  {
    value: "undecided",
    label: "Not decided yet",
    hint: "Scored against everything, which is the honest answer when the route is open.",
  },
];

// ---------------------------------------------------------------------------
// Q2 — device characteristics. The codes are content.modules; the question text
// each one carries (ModuleDef.q) is written for exactly this purpose, so the
// server passes those strings straight through rather than restating them here.
//
// IVD is not offered: it follows from the IVDR route. FDA is not offered: it is
// the US market question, asked with the route. The implication rules below
// mirror ProfileSelector.toggleChar so a profile built here and a profile built
// in the app cannot disagree.
// ---------------------------------------------------------------------------
export const CHARACTERISTIC_CODES = [
  "SW",
  "AI",
  "HW",
  "ACT",
  "STE",
  "SEC",
  "PRIV",
  "SELF",
  "CDX",
] as const;
export type CharacteristicCode = (typeof CHARACTERISTIC_CODES)[number];

/** IVD sub-types are IVDR concepts; they are only asked on the IVDR route. */
export const IVDR_ONLY_CHARACTERISTICS: string[] = ["SELF", "CDX"];

/** AI implies software; active and sterile imply physical hardware. */
export const CHARACTERISTIC_IMPLIES: Record<string, string[]> = {
  AI: ["SW"],
  ACT: ["HW"],
  STE: ["HW"],
};

export type DeviceProfile = Record<string, number>;

/**
 * Answers → the device profile that scopes the corpus.
 *
 * The single place the two axes are assembled, so the questionnaire, the score
 * and the rendered scope line all describe the same device.
 */
export function profileFrom(answers: Answers): DeviceProfile {
  const p: DeviceProfile = {};
  if (answers.route === "MDR") p.MDR = 1;
  if (answers.route === "IVDR") {
    p.IVDR = 1;
    p.IVD = 1; // an IVDR device IS an IVD — same rule as ProfileSelector
  }
  if (answers.route === "FDA") p.FDA = 1;
  if (answers.usMarket) p.FDA = 1;

  answers.characteristics.forEach((code) => {
    if (answers.route !== "IVDR" && IVDR_ONLY_CHARACTERISTICS.includes(code))
      return;
    p[code] = 1;
    (CHARACTERISTIC_IMPLIES[code] ?? []).forEach((implied) => {
      p[implied] = 1;
    });
  });
  return p;
}

// ---------------------------------------------------------------------------
// Q3 — risk class. Free choice from the MDR and IVDR scales, as in
// lib/startup/application.ts. It drives one thing only: whether a notified body
// is needed at all (MDR class I and IVDR class A, non-sterile and without a
// measuring function, self-certify).
// ---------------------------------------------------------------------------
export const RISK_CLASSES = [
  "I",
  "IIa",
  "IIb",
  "III",
  "A",
  "B",
  "C",
  "D",
  "unsure",
] as const;
export type RiskClass = (typeof RISK_CLASSES)[number];

export const MDR_CLASSES: RiskClass[] = ["I", "IIa", "IIb", "III"];
export const IVDR_CLASSES: RiskClass[] = ["A", "B", "C", "D"];

/** True when the class may be self-certified, i.e. a notified body is optional. */
export function selfCertifiable(riskClass: RiskClass): boolean {
  return riskClass === "I" || riskClass === "A";
}

// ---------------------------------------------------------------------------
// Q4 — where they are on the four phases.
//
// The values are not evenly spaced. "Started" is worth 0.25 rather than 0.33
// because the failure mode this product exists to fix is a phase that has been
// "started" for a year; and "most of it" stops at 0.65 because the last third of
// a phase is where the records and approvals live, which is the part a notified
// body actually looks at.
// ---------------------------------------------------------------------------
export const PHASE_LEVELS = ["none", "started", "most", "done"] as const;
export type PhaseLevel = (typeof PHASE_LEVELS)[number];

export const PHASE_LEVEL_VALUE: Record<PhaseLevel, number> = {
  none: 0,
  started: 0.25,
  most: 0.65,
  done: 1,
};

export const PHASE_LEVEL_LABEL: Record<PhaseLevel, string> = {
  none: "Not started",
  started: "Started — under half",
  most: "More than half",
  done: "Complete and approved",
};

// ---------------------------------------------------------------------------
// Q5 — the twelve core processes, one per QSE.
//
// `anchors` is an ordered candidate list, not a single id, because four of the
// twelve QSEs are populated only by characteristic-scoped activities: a device
// with no connectivity and no personal data genuinely has no Information
// Management process to audit. The first in-scope anchor wins; when none is in
// scope the process is reported as not applicable rather than as a gap, which is
// the whole point of scoping the question set to the device.
//
// `draft` is worth 0.45, not 0.5: an unapproved SOP is a finding at Stage 1, so
// it must score below half.
// ---------------------------------------------------------------------------
export const CORE_LEVELS = ["none", "draft", "inuse"] as const;
export type CoreLevel = (typeof CORE_LEVELS)[number];

export const CORE_LEVEL_VALUE: Record<CoreLevel, number> = {
  none: 0,
  draft: 0.45,
  inuse: 1,
};

export const CORE_LEVEL_LABEL: Record<CoreLevel, string> = {
  none: "Nothing yet",
  draft: "Drafted, not approved",
  inuse: "Approved and in use",
};

export type CoreProcessDef = {
  key: string;
  label: string;
  /** The QSE this process is the Stage-1 evidence for. */
  qse: string;
  /** Candidate corpus activities, best first; the first in scope is used. */
  anchors: string[];
};

export const CORE_PROCESSES: CoreProcessDef[] = [
  {
    key: "doc",
    label: "Document and record control",
    qse: "Documents & Records",
    anchors: ["DOC.establish"],
  },
  {
    key: "qmn",
    label: "Quality manual, policy and objectives",
    qse: "Organisation",
    anchors: ["QMN.establish"],
  },
  {
    key: "hrt",
    label: "Roles, responsibilities and training",
    qse: "Personnel",
    anchors: ["HRT.establish"],
  },
  {
    key: "inf",
    label: "Infrastructure and work environment",
    qse: "Equipment",
    anchors: ["INF.establish"],
  },
  {
    key: "pur",
    label: "Supplier evaluation and purchasing",
    qse: "Purchasing",
    anchors: ["PUR.establish"],
  },
  {
    key: "dev",
    label: "Design and development control",
    qse: "Process Management",
    anchors: ["DEV.establish"],
  },
  {
    key: "rsk",
    label: "Risk management procedure",
    qse: "Continual Improvement",
    anchors: ["RSK.proc"],
  },
  {
    key: "aud",
    label: "Internal audit programme",
    qse: "Assessment",
    anchors: ["AUD.establish", "CHG.setup"],
  },
  {
    key: "cap",
    label: "CAPA and complaint handling",
    qse: "Nonconforming-Event Mgmt",
    anchors: ["CAP.setup", "CMP.setup"],
  },
  {
    key: "std",
    label: "Applicable legislation and standards list",
    qse: "Customer Focus",
    anchors: ["TEF.stdlist"],
  },
  {
    key: "inm",
    label: "Information security and data protection",
    qse: "Information Management",
    // SEC first, then PRIV, then AI: whichever axis the device actually has.
    anchors: ["ISM.establish", "DPR.establish", "AIM.plan"],
  },
  {
    key: "fac",
    label: "Continuity, backups and facility controls",
    qse: "Facilities & Safety",
    anchors: ["BCP.establish", "PSA.setup"],
  },
];

// ---------------------------------------------------------------------------
// Q6 — the notified body ladder, and what each rung implies about the three
// certification activities in the corpus (TEF.nb, TEF.certify.stage1,
// TEF.certify.stage2). These are self-reported facts rather than estimates,
// which is why they override the phase answer for those activities.
// ---------------------------------------------------------------------------
export const NB_STATES = [
  "none",
  "shortlisting",
  "contracted",
  "booked",
  "certified",
] as const;
export type NbState = (typeof NB_STATES)[number];

export const NB_OPTIONS: { value: NbState; label: string }[] = [
  { value: "none", label: "Not started" },
  { value: "shortlisting", label: "Shortlisting / requesting quotes" },
  { value: "contracted", label: "Contract signed" },
  { value: "booked", label: "Review slot booked" },
  { value: "certified", label: "Assessed and certified" },
];

/** [TEF.nb, TEF.certify.stage1, TEF.certify.stage2] completion per rung. */
export const NB_ACTIVITY_VALUE: Record<NbState, [number, number, number]> = {
  none: [0, 0, 0],
  shortlisting: [0.4, 0, 0],
  contracted: [1, 0.1, 0],
  booked: [1, 0.5, 0.1],
  certified: [1, 1, 1],
};

export const NB_ACTIVITY_IDS = [
  "TEF.nb",
  "TEF.certify.stage1",
  "TEF.certify.stage2",
] as const;

// ---------------------------------------------------------------------------
// Q7 — timeline pressure. The working-day budgets are the comparison the
// verdict is made against; null means "no date to miss".
// ---------------------------------------------------------------------------
export const PRESSURES = ["none", "year_plus", "six_to_twelve", "under_six", "late"] as const;
export type Pressure = (typeof PRESSURES)[number];

export const PRESSURE_OPTIONS: { value: Pressure; label: string }[] = [
  { value: "none", label: "No fixed date yet" },
  { value: "year_plus", label: "More than 12 months out" },
  { value: "six_to_twelve", label: "6–12 months" },
  { value: "under_six", label: "Under 6 months" },
  { value: "late", label: "We are already past the date we wanted" },
];

/** Working days available, at roughly 21 per month. null = no deadline. */
export const PRESSURE_BUDGET_DAYS: Record<Pressure, number | null> = {
  none: null,
  year_plus: 315,
  six_to_twelve: 189,
  under_six: 105,
  late: 0,
};

// ---------------------------------------------------------------------------
// Answers
// ---------------------------------------------------------------------------
export type Answers = {
  route: Route;
  /** True when the US market is also in scope alongside an EU route. */
  usMarket: boolean;
  characteristics: string[];
  riskClass: RiskClass;
  /** Keyed by phase number as a string, so it survives JSON unchanged. */
  phases: Record<string, PhaseLevel>;
  /** Keyed by CoreProcessDef.key. */
  core: Record<string, CoreLevel>;
  nb: NbState;
  pressure: Pressure;
  orgName: string | null;
  role: string | null;
};

export const ORG_NAME_MAX = 160;
export const ROLE_MAX = 80;
export const EMAIL_MAX = 320;

export const ROLE_OPTIONS = [
  "Founder / CEO",
  "QA / RA lead",
  "Engineering lead",
  "Consultant",
  "Investor / accelerator",
  "Other",
] as const;

export const DEFAULT_ANSWERS: Answers = {
  route: "MDR",
  usMarket: false,
  characteristics: [],
  riskClass: "unsure",
  phases: { "1": "none", "2": "none", "3": "none", "4": "none" },
  core: Object.fromEntries(CORE_PROCESSES.map((p) => [p.key, "none"])),
  nb: "none",
  pressure: "none",
  orgName: null,
  role: null,
};

// ---------------------------------------------------------------------------
// Parsing. The questionnaire posts its state as one JSON field, so this is the
// trust boundary: every value is re-derived from an allowlist and anything
// unrecognised falls back to the default rather than reaching the scorer. A
// scorer that can be handed arbitrary strings is a scorer that can be made to
// produce an arbitrary score, and the score is the thing we are asking people to
// forward to investors.
// ---------------------------------------------------------------------------
function oneOf<T extends string>(all: readonly T[], v: unknown, fallback: T): T {
  return typeof v === "string" && (all as readonly string[]).includes(v)
    ? (v as T)
    : fallback;
}

function trimmed(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().replace(/\s+/g, " ");
  return s ? s.slice(0, max) : null;
}

export function parseAnswers(raw: unknown): Answers {
  const o = (raw ?? {}) as Record<string, unknown>;

  const route = oneOf(ROUTES, o.route, DEFAULT_ANSWERS.route);

  const chars = Array.isArray(o.characteristics) ? o.characteristics : [];
  const characteristics = (CHARACTERISTIC_CODES as readonly string[]).filter(
    (code) =>
      chars.includes(code) &&
      (route === "IVDR" || !IVDR_ONLY_CHARACTERISTICS.includes(code)),
  );

  const phasesRaw = (o.phases ?? {}) as Record<string, unknown>;
  const phases: Record<string, PhaseLevel> = {};
  for (const n of ["1", "2", "3", "4"]) {
    phases[n] = oneOf(PHASE_LEVELS, phasesRaw[n], "none");
  }

  const coreRaw = (o.core ?? {}) as Record<string, unknown>;
  const core: Record<string, CoreLevel> = {};
  CORE_PROCESSES.forEach((p) => {
    core[p.key] = oneOf(CORE_LEVELS, coreRaw[p.key], "none");
  });

  return {
    route,
    usMarket: o.usMarket === true,
    characteristics,
    riskClass: oneOf(RISK_CLASSES, o.riskClass, DEFAULT_ANSWERS.riskClass),
    phases,
    core,
    nb: oneOf(NB_STATES, o.nb, DEFAULT_ANSWERS.nb),
    pressure: oneOf(PRESSURES, o.pressure, DEFAULT_ANSWERS.pressure),
    orgName: trimmed(o.orgName, ORG_NAME_MAX),
    role: trimmed(o.role, ROLE_MAX),
  };
}

/**
 * Email validation, deliberately shallow.
 *
 * One @, something either side, a dot in the domain, no whitespace. Anything
 * stricter rejects real addresses, and the only thing we actually need to be
 * true is that the value is an address-shaped string we are willing to store.
 */
export function normaliseEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const e = raw.trim().toLowerCase();
  if (e.length < 5 || e.length > EMAIL_MAX) return null;
  if (!/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(e)) return null;
  return e;
}

// ---------------------------------------------------------------------------
// Result — the shape the report renders and the shape frozen into
// readiness_leads.result. Serialisable only: it crosses a server-action
// boundary and then sits in jsonb for years.
// ---------------------------------------------------------------------------
export type Band = {
  key: string;
  label: string;
  blurb: string;
};

export type PhaseScore = {
  n: number;
  name: string;
  pct: number;
  /** In-scope activities in this phase, and how many read as complete. */
  inScope: number;
  complete: number;
};

export type QseScore = {
  qse: string;
  /** null when no activity in this QSE applies to the device. */
  pct: number | null;
  inScope: number;
};

export type CoreStatus = {
  key: string;
  label: string;
  qse: string;
  /** null when this QSE has no in-scope activity — reported, not penalised. */
  activityId: string | null;
  statement: string | null;
  level: CoreLevel | null;
  /** The corpus's minimum-viable version of this process. */
  leanStart: string | null;
};

export type Gap = {
  id: string;
  phase: number;
  phaseName: string;
  qse: string;
  statement: string;
  clause: string | null;
  /** activity.lean.start — the specific first step that closes this gap. */
  leanStart: string | null;
  /** The controlled documents this activity produces. */
  docIds: string[];
  docCount: number;
  critical: boolean;
  days: number;
  /** How many later activities this one unblocks, over the dependency graph. */
  unblocks: number;
};

export type ReadinessResult = {
  scorerVersion: string;
  contentHash: string | null;
  generatedAt: string;

  org: { name: string | null; role: string | null };

  scope: {
    route: Route;
    routeLabel: string;
    riskClass: RiskClass;
    usMarket: boolean;
    characteristics: { code: string; label: string }[];
    activities: number;
    activitiesTotal: number;
    documents: number;
    documentsTotal: number;
  };

  overall: number;
  band: Band;
  components: {
    foundation: number;
    roadmap: number;
    certification: number;
  };

  stage1: { pct: number; inUse: number; drafted: number; applicable: number };
  phases: PhaseScore[];
  qses: QseScore[];
  core: CoreStatus[];

  notifiedBody: {
    state: NbState;
    label: string;
    required: boolean;
    warning: string | null;
  };

  timeline: {
    pressure: Pressure;
    pressureLabel: string;
    budgetDays: number | null;
    criticalDays: number;
    remainingDays: number;
    verdict: string;
  };

  gaps: Gap[];
  gapsTotal: number;
};

// ---------------------------------------------------------------------------
// Bands. Five, because three is not enough to show movement between a day-0 and
// a day-60 run (§6.4 stage 2) and seven is more precision than a self-assessment
// can honestly carry.
// ---------------------------------------------------------------------------
export const BANDS: (Band & { min: number })[] = [
  {
    min: 0,
    key: "pre",
    label: "No system yet",
    blurb:
      "There is nothing a notified body could audit today. That is a normal place to start, and it is the cheapest place to fix: almost all of what is missing is phase 1 and does not depend on the device being finished.",
  },
  {
    min: 20,
    key: "foundations",
    label: "Foundations forming",
    blurb:
      "Some of the QMS core exists. The risk at this stage is building the device faster than the system that has to control it, which is what turns design work into rework.",
  },
  {
    min: 40,
    key: "developing",
    label: "Developing under control",
    blurb:
      "The system is real and development is running inside it. What usually decides the timeline from here is evidence completeness, not more procedures.",
  },
  {
    min: 60,
    key: "evidence",
    label: "Evidence building",
    blurb:
      "Most of the system and much of the evidence is in place. The remaining gaps are specific and finishable, and the notified body queue is now the thing most likely to move your date.",
  },
  {
    min: 80,
    key: "audit",
    label: "Audit-track",
    blurb:
      "This reads like a company heading into a notified-body assessment rather than preparing for one. What is left is closing named gaps and keeping the live system running.",
  },
];

export function bandFor(overall: number): Band {
  let found = BANDS[0];
  BANDS.forEach((b) => {
    if (overall >= b.min) found = b;
  });
  return { key: found.key, label: found.label, blurb: found.blurb };
}

/**
 * The short name of a phase, taken from the head of content.phases[].focus.
 *
 * Same derivation DashboardClient uses, and deliberately NOT PHASE_NAMES: that
 * map calls phase 3 "Govern & lead" and phase 4 "Certify, launch & improve",
 * while the focus text those headings sit above opens "Verify, validate & make"
 * and "Certify, launch & operate". Printing both side by side on an artefact
 * someone forwards to an investor would make the corpus look unsure what its own
 * phases are called, so the title is derived from the text it labels.
 */
export function phaseTitle(focus: string, n: number): string {
  const head = focus.split(/:| - /)[0].trim();
  return head || `Phase ${n}`;
}

/** The rest of the focus text, with the title phaseTitle() took off the front. */
export function phaseDetail(focus: string): string {
  const i = focus.search(/:| - /);
  if (i < 0) return focus;
  const rest = focus.slice(i).replace(/^(:| - )/, "").trim();
  return rest ? rest.charAt(0).toUpperCase() + rest.slice(1) : focus;
}

export const ROUTE_LABEL: Record<Route, string> = {
  MDR: "EU MDR",
  IVDR: "EU IVDR",
  FDA: "US (FDA) first",
  undecided: "Route not yet decided",
};

export const PRESSURE_LABEL: Record<Pressure, string> = Object.fromEntries(
  PRESSURE_OPTIONS.map((o) => [o.value, o.label]),
) as Record<Pressure, string>;

export const NB_LABEL: Record<NbState, string> = Object.fromEntries(
  NB_OPTIONS.map((o) => [o.value, o.label]),
) as Record<NbState, string>;

/** The consent wording stored verbatim with the flag. See migration 0024. */
export const CHANGELOG_CONSENT =
  "I'd like the quarterly regulatory changelog by email — what changed in MDR/IVDR and ISO 13485 guidance, and which documents it touches. Unsubscribe any time.";
