// Scoring the readiness self-assessment against the corpus.
//
// SERVER ONLY — it imports lib/content/content.ts, which reads content.json from
// disk. The questionnaire never sees this file; it posts answers and gets a
// finished ReadinessResult back from the server action. Two reasons that is the
// right split: the scoring rules are the product, and a score computed in the
// browser is a score the respondent can edit before forwarding it.
//
// ---------------------------------------------------------------------------
// HOW THE NUMBER IS MADE
//
// Everything is measured against the activities that are IN SCOPE for the
// device, never against all 116. A software-only SaMD company is not behind
// because it has no sterilisation validation; it simply does not have that
// activity. This is the same scoping (lib/content/scope.ts) that the paid
// roadmap uses, which is what makes the free score and the paid plan line up.
//
// Each in-scope activity gets a completion estimate between 0 and 1, from the
// most specific answer available:
//
//   1. it is one of the three notified-body activities  -> the NB ladder (Q6)
//   2. it is the anchor of one of the 12 core processes  -> that answer (Q5)
//   3. otherwise                                         -> its phase answer (Q4)
//
// and a weight: 2 on the critical path, 1 otherwise. A gap on the critical path
// moves the certification date, a gap beside it does not, and a readiness figure
// that treats those as equal is not telling the reader anything useful.
//
// The headline is a weighted blend of three sub-scores:
//
//   foundation    (0.35) — the 12 Stage-1 core processes, equally weighted
//   roadmap       (0.50) — weighted completion of the in-scope activity set
//   certification (0.15) — how far the notified-body engagement has actually got
//
// Foundation and roadmap overlap: the 12 anchors are inside the activity set, so
// the QMS core is deliberately counted twice. That is not double-counting by
// accident — it is the weighting a Stage 1 audit itself applies, where the
// absence of document control matters more than the absence of any single piece
// of design evidence.
// ---------------------------------------------------------------------------

import { createHash } from "node:crypto";
import {
  CRITset,
  EDGES,
  content,
  counts,
  docWorkflow,
  expandRefs,
  inScopeAct,
  inScopeDoc,
  pnum,
} from "@/lib/content/content";
import type { Activity, Profile } from "@/lib/content/types";
import {
  CORE_LEVEL_VALUE,
  CORE_PROCESSES,
  NB_ACTIVITY_IDS,
  NB_ACTIVITY_VALUE,
  NB_LABEL,
  PHASE_LEVEL_VALUE,
  PRESSURE_BUDGET_DAYS,
  PRESSURE_LABEL,
  ROUTE_LABEL,
  phaseTitle,
  SCORER_VERSION,
  bandFor,
  profileFrom,
  selfCertifiable,
  type Answers,
  type CoreLevel,
  type CoreStatus,
  type Gap,
  type PhaseScore,
  type QseScore,
  type ReadinessResult,
} from "./assessment";

/** How many gaps the report lists. Beyond this it stops being a to-do list. */
const MAX_GAPS = 15;

const WEIGHTS = { foundation: 0.35, roadmap: 0.5, certification: 0.15 } as const;

/** An activity is read as "complete" for counting purposes at 0.99 and above. */
const COMPLETE = 0.99;

// A fingerprint of the corpus this score was computed against, so a future
// re-read can tell whether the activity set has moved under an old result.
// DERIVED, not read from content.meta.json — that file is a summary the external
// pipeline emits and it goes stale between regenerations (see counts() in
// lib/content/content.ts for the same trap).
let _hash: string | null = null;
function corpusFingerprint(): string {
  if (_hash) return _hash;
  const ids = content.activities
    .map((a) => a.id)
    .sort()
    .join(",");
  _hash = createHash("sha1")
    .update(`${ids}|${content.documents.length}`)
    .digest("hex")
    .slice(0, 16);
  return _hash;
}

const byId = new Map(content.activities.map((a) => [a.id, a]));

// How many later activities each one unblocks, transitively, over the corpus
// dependency graph (EDGES in lib/content/content.ts).
//
// This is what breaks ties in the gap ranking, and it is the honest answer to
// "which of these do I do first?" when two gaps cost the score the same amount.
// idnum() cannot do that job here: these activity ids are dotted names like
// DEV.establish, not the numbered 1.2 form it parses, so it returns 0 for every
// one of them and the sort collapses into insertion order.
const UNBLOCKS: Map<string, number> = (() => {
  const succ = new Map<string, string[]>();
  EDGES.forEach(([from, to]) => {
    const list = succ.get(from);
    if (list) list.push(to);
    else succ.set(from, [to]);
  });
  const memo = new Map<string, Set<string>>();
  const walk = (id: string, stack: Set<string>): Set<string> => {
    const hit = memo.get(id);
    if (hit) return hit;
    const out = new Set<string>();
    // The corpus graph is a DAG, but a cycle introduced upstream must degrade to
    // a slightly wrong number rather than blow the stack on every page render.
    if (stack.has(id)) return out;
    stack.add(id);
    (succ.get(id) ?? []).forEach((next) => {
      out.add(next);
      walk(next, stack).forEach((x) => out.add(x));
    });
    stack.delete(id);
    memo.set(id, out);
    return out;
  };
  return new Map(
    content.activities.map((a) => [a.id, walk(a.id, new Set()).size]),
  );
})();

function pct(n: number): number {
  return Math.round(Math.max(0, Math.min(1, n)) * 100);
}

/**
 * Which activity stands for each core process, given the device.
 *
 * Returns null when no candidate is in scope: four of the twelve QSEs are
 * populated only by characteristic-scoped activities, and a device with no
 * connectivity, no personal data and no physical hardware genuinely has no
 * Facilities & Safety process for a notified body to look at. Reporting that as
 * "not applicable" rather than as a zero is the difference between a scoped
 * assessment and a checklist.
 */
function resolveAnchor(
  anchors: string[],
  profile: Profile,
): Activity | null {
  for (const id of anchors) {
    const a = byId.get(id);
    if (a && inScopeAct(a, profile)) return a;
  }
  return null;
}

export function score(answers: Answers): ReadinessResult {
  const profile = profileFrom(answers);
  const hasProfile = Object.keys(profile).length > 0;
  // An unconfigured profile (route undecided, no characteristics) must stay
  // null, not {}: scope.ts treats null as "show everything", and {} as a profile
  // that has chosen nothing, which hides every characteristic-scoped item.
  const prof = hasProfile ? profile : null;

  const inScope = content.activities.filter((a) => inScopeAct(a, prof));

  // ---- notified body -----------------------------------------------------
  // Required unless the class self-certifies. "unsure" counts as required: the
  // expensive mistake is assuming you do not need one.
  const nbRequired = !selfCertifiable(answers.riskClass);
  const nbValues = NB_ACTIVITY_VALUE[answers.nb];
  const nbByActivity = new Map<string, number>(
    NB_ACTIVITY_IDS.map((id, i) => [id, nbValues[i]]),
  );

  // ---- core processes ----------------------------------------------------
  const core: CoreStatus[] = CORE_PROCESSES.map((def) => {
    const anchor = resolveAnchor(def.anchors, prof);
    return {
      key: def.key,
      label: def.label,
      qse: def.qse,
      activityId: anchor?.id ?? null,
      statement: anchor?.statement ?? null,
      level: anchor ? (answers.core[def.key] ?? "none") : null,
      leanStart: anchor?.lean?.start ?? null,
    };
  });

  const applicableCore = core.filter((c) => c.level !== null);
  const coreByAnchor = new Map<string, CoreLevel>();
  applicableCore.forEach((c) => {
    if (c.activityId) coreByAnchor.set(c.activityId, c.level as CoreLevel);
  });

  const foundation = applicableCore.length
    ? applicableCore.reduce(
        (s, c) => s + CORE_LEVEL_VALUE[c.level as CoreLevel],
        0,
      ) / applicableCore.length
    : 0;

  // ---- per-activity completion -------------------------------------------
  const completion = new Map<string, number>();
  inScope.forEach((a) => {
    // A notified-body activity on a self-certifying device is not a gap, it is
    // not applicable — so it is dropped from the scored set entirely rather
    // than scored as zero.
    if (!nbRequired && nbByActivity.has(a.id)) return;

    const fromNb = nbByActivity.get(a.id);
    if (fromNb !== undefined) {
      completion.set(a.id, fromNb);
      return;
    }
    const fromCore = coreByAnchor.get(a.id);
    if (fromCore !== undefined) {
      completion.set(a.id, CORE_LEVEL_VALUE[fromCore]);
      return;
    }
    completion.set(a.id, PHASE_LEVEL_VALUE[answers.phases[String(pnum(a.phase))] ?? "none"]);
  });

  const scored = inScope.filter((a) => completion.has(a.id));
  const weight = (a: Activity) => (CRITset[a.id] ? 2 : 1);

  const weighted = (acts: Activity[]) => {
    let num = 0;
    let den = 0;
    acts.forEach((a) => {
      const w = weight(a);
      num += w * (completion.get(a.id) ?? 0);
      den += w;
    });
    return den ? num / den : 0;
  };

  const roadmap = weighted(scored);

  // ---- certification -----------------------------------------------------
  // The mean of the three NB rungs when a notified body is in play. When the
  // class self-certifies there is no NB to measure, but there is still a
  // technical file and a Declaration of Conformity to produce — which is what
  // phase 4 is — so phase 4 stands in.
  const certification = nbRequired
    ? (nbValues[0] + nbValues[1] + nbValues[2]) / 3
    : PHASE_LEVEL_VALUE[answers.phases["4"] ?? "none"];

  const overall = pct(
    WEIGHTS.foundation * foundation +
      WEIGHTS.roadmap * roadmap +
      WEIGHTS.certification * certification,
  );

  // ---- breakdowns --------------------------------------------------------
  const phases: PhaseScore[] = content.phases.map((p) => {
    const acts = scored.filter((a) => pnum(a.phase) === p.n);
    return {
      n: p.n,
      name: phaseTitle(p.focus, p.n),
      pct: pct(weighted(acts)),
      inScope: acts.length,
      complete: acts.filter((a) => (completion.get(a.id) ?? 0) >= COMPLETE).length,
    };
  });

  const qses: QseScore[] = content.qses.map((q) => {
    const acts = scored.filter((a) => a.qse === q);
    return {
      qse: q,
      pct: acts.length ? pct(weighted(acts)) : null,
      inScope: acts.length,
    };
  });

  const stage1 = {
    pct: pct(foundation),
    inUse: applicableCore.filter((c) => c.level === "inuse").length,
    drafted: applicableCore.filter((c) => c.level === "draft").length,
    applicable: applicableCore.length,
  };

  // ---- gaps --------------------------------------------------------------
  // PHASE FIRST, then cost. Ranking purely by cost — weight × shortfall — put
  // "compile the technical file" above unfinished design verification for a
  // company still in phase 2, because an untouched phase-4 activity costs the
  // score more than a half-done phase-3 one. That is arithmetically true and
  // useless as advice: this list is read as an order of work, so it has to run
  // in the order the roadmap does.
  //
  // Within a phase: whatever is costing the most, then earliest start, then
  // whatever unblocks more of what follows, then the id so the order is stable
  // between runs. Anything already complete is not a gap.
  const openGaps = scored
    .filter((a) => (completion.get(a.id) ?? 0) < COMPLETE)
    .sort((x, y) => {
      const sx = weight(x) * (1 - (completion.get(x.id) ?? 0));
      const sy = weight(y) * (1 - (completion.get(y.id) ?? 0));
      return (
        pnum(x.phase) - pnum(y.phase) ||
        sy - sx ||
        (x.es ?? 0) - (y.es ?? 0) ||
        (UNBLOCKS.get(y.id) ?? 0) - (UNBLOCKS.get(x.id) ?? 0) ||
        x.id.localeCompare(y.id)
      );
    });

  const gaps: Gap[] = openGaps.slice(0, MAX_GAPS).map((a) => {
    const groups = docWorkflow(a.documents);
    const docIds = expandRefs(a.documents);
    return {
      id: a.id,
      phase: pnum(a.phase),
      phaseName: phaseTitle(
        content.phases[pnum(a.phase) - 1]?.focus ?? "",
        pnum(a.phase),
      ),
      qse: a.qse,
      statement: a.statement,
      clause: a.clause ?? null,
      leanStart: a.lean?.start ?? null,
      // The procedures and templates first — they are what someone actually
      // opens to close the gap, and they are the hook into full access.
      docIds: [...groups.adopt, ...groups.templates].map((d) => d.id).slice(0, 6),
      docCount: docIds.length,
      critical: !!CRITset[a.id],
      days: a.dur ?? 0,
      unblocks: UNBLOCKS.get(a.id) ?? 0,
    };
  });

  // ---- timeline ----------------------------------------------------------
  // Remaining effort, discounted by how far each activity already is. The
  // critical-path figure is the one that bounds the date; the total is the one
  // that bounds the headcount.
  const remainingDays = Math.round(
    scored.reduce(
      (s, a) => s + (a.dur ?? 0) * (1 - (completion.get(a.id) ?? 0)),
      0,
    ),
  );
  const criticalDays = Math.round(
    scored
      .filter((a) => CRITset[a.id])
      .reduce((s, a) => s + (a.dur ?? 0) * (1 - (completion.get(a.id) ?? 0)), 0),
  );

  const budgetDays = PRESSURE_BUDGET_DAYS[answers.pressure];
  const verdict = timelineVerdict(
    criticalDays,
    remainingDays,
    budgetDays,
    answers.pressure === "late",
  );

  // The lead times are the corpus's own (activity TEF.nb: a contract in about
  // three months, the review within about nine), not an estimate of ours.
  const nbWarning =
    nbRequired && (answers.nb === "none" || answers.nb === "shortlisting")
      ? "A notified body is required for this class and is not engaged yet. The corpus puts a contract at roughly three months and the documentation review within roughly nine, and TEF.nb sits on the critical path — so this is usually the single largest unbooked delay in a launch plan."
      : null;

  const documentsInScope = content.documents.filter((d) =>
    inScopeDoc(d.module, prof, d.reg),
  ).length;

  const n = counts();

  return {
    scorerVersion: SCORER_VERSION,
    contentHash: corpusFingerprint(),
    generatedAt: new Date().toISOString(),

    org: { name: answers.orgName, role: answers.role },

    scope: {
      route: answers.route,
      routeLabel: ROUTE_LABEL[answers.route],
      riskClass: answers.riskClass,
      usMarket: answers.usMarket || answers.route === "FDA",
      characteristics: answers.characteristics.map((code) => ({
        code,
        label: content.modules.find((m) => m.code === code)?.label ?? code,
      })),
      activities: scored.length,
      activitiesTotal: n.activities,
      documents: documentsInScope,
      documentsTotal: n.documents,
    },

    overall,
    band: bandFor(overall),
    components: {
      foundation: pct(foundation),
      roadmap: pct(roadmap),
      certification: pct(certification),
    },

    stage1,
    phases,
    qses,
    core,

    notifiedBody: {
      state: answers.nb,
      label: NB_LABEL[answers.nb],
      required: nbRequired,
      warning: nbWarning,
    },

    timeline: {
      pressure: answers.pressure,
      pressureLabel: PRESSURE_LABEL[answers.pressure],
      budgetDays,
      criticalDays,
      remainingDays,
      verdict,
    },

    gaps,
    gapsTotal: openGaps.length,
  };
}

/**
 * The one or two sentences that make the timeline honest.
 *
 * Two different numbers, and conflating them is the easy mistake:
 *
 *   • criticalDays is the longest chain of work that cannot be parallelised. It
 *     is a FLOOR on elapsed time, never a forecast.
 *   • remainingDays is total effort across every open in-scope activity. It is
 *     what decides how many people the floor needs.
 *
 * An earlier version of this function said "the work fits the window" whenever
 * the critical path fit, which told a two-person company with 300 days of work
 * left and 105 days of runway that it was fine. So the only thing stated as a
 * fact now is when the critical path ALONE overruns; otherwise it reports the
 * parallelism the window implies and lets the reader judge whether they have
 * it.
 */
function timelineVerdict(
  criticalDays: number,
  remainingDays: number,
  budgetDays: number | null,
  alreadyLate: boolean,
): string {
  if (remainingDays <= 0)
    return "Nothing in scope reads as open, so there is no remaining effort to compare against a date. That is worth re-reading as a question rather than an answer: a self-assessment with no gaps usually means the answers were kinder than the evidence.";

  const effort = `About ${criticalDays} working days of that sit on the critical path, which is a floor on elapsed time however many people you add.`;

  if (alreadyLate)
    return `Roughly ${remainingDays} working days of regulatory work are still open. ${effort} Since the date has already passed, the question worth answering is which of the gaps below can genuinely run in parallel.`;

  if (budgetDays === null)
    return `Roughly ${remainingDays} working days of regulatory work are still open. ${effort} There is no date to miss yet, which makes this the cheapest moment to book notified-body capacity and set one.`;

  if (criticalDays > budgetDays)
    return `Roughly ${remainingDays} working days of regulatory work are still open against about ${budgetDays} available. The critical path alone is longer than the window, so the date moves unless the scope does.`;

  const people = Math.max(1, Math.ceil((remainingDays / budgetDays) * 10) / 10);
  if (people > 1.2)
    return `Roughly ${remainingDays} working days of regulatory work are still open against about ${budgetDays} available. ${effort} Fitting the rest into the window needs roughly ${people} people on this full-time, and nothing sequenced badly.`;

  return `Roughly ${remainingDays} working days of regulatory work are still open against about ${budgetDays} available. ${effort} The effort fits one full-time person; what usually breaks a plan from here is queueing — notified-body slots, test-house lead times — rather than effort.`;
}
