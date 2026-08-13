// Everything the per-document prompt needs, assembled from helpers that already
// exist. This module ASSEMBLES; it does not author. If a value here has no
// source in content.json or the process model, it does not belong in a prompt.
//
// SERVER ONLY — it reads the corpus through lib/content/content.ts (node:fs).

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  byDocId,
  docActivities,
  docStep,
  docWorkflow,
  getActivity,
  expandRefs,
} from "@/lib/content/content";
import { getProcessModel } from "@/lib/content/process";
import { euRoute, type ScopeProfile } from "@/lib/content/scope";
import {
  deriveSkeleton,
  stripGuidance,
  type SkeletonFacts,
} from "@notjustany/doc-contract";
import type { DocItem, ClauseMap } from "@/lib/content/types";

export type FillMode = "author" | "scaffold";

/** FOR and LIS record what happened. They are scaffolded, never filled. */
export function fillModeFor(cls: string): FillMode {
  return cls === "FOR" || cls === "LIS" ? "scaffold" : "author";
}

const HAS_PLACEHOLDER = /\[[^\]\n]*\]/;

/**
 * The PRO-FORMAS — masters an organisation clones to CREATE a document, rather
 * than documents to fill in. Their placeholders are the deliverable: filling
 * them produces one instance and destroys the master.
 *
 * A curated list, for the same reason HANDOFF_ACTIVITIES is one: nothing in
 * content.json marks it, and the class cannot tell you — these two are TPL
 * exactly like the other 125 templates.
 *
 * It is a LIST rather than the inference below because of which way each fails.
 * A document wrongly treated as a pro-forma is never filled in at all, and says
 * nothing about it: the prompt tells the agent to leave the placeholders, the
 * agent does, and the validator agrees. The output looks correct and is empty.
 * A list can only be wrong about documents someone chose to put in it.
 */
export const PRO_FORMA_DOCS = new Set(["DOC-TPL-01", "DOC-TPL-03"]);

export function isProForma(docId: string): boolean {
  return PRO_FORMA_DOCS.has(docId);
}

/**
 * What a pro-forma LOOKS like: a blank carrying a placeholder where its own
 * Document ID or title belongs.
 *
 * Not used to decide anything — `PRO_FORMA_DOCS` decides. This exists so the
 * corpus sweep can compare the two and fail the build when they disagree,
 * which is what turns "someone must remember to update the list" into
 * something the build tells you. A regenerated corpus that adds a third
 * pro-forma, or a document that grows a bracket in its title for an unrelated
 * reason, both surface here rather than in a customer's empty draft.
 */
export function looksProForma(contract: SkeletonFacts): boolean {
  const id = contract.headerbandRows.find((r) => r.label === "Document ID")?.value ?? "";
  return HAS_PLACEHOLDER.test(id) || HAS_PLACEHOLDER.test(contract.h1Text);
}

export type PromptVars = {
  doc: DocItem;
  fillMode: FillMode;
  /** adopt | template | record | register — where it sits in the workflow */
  role: string;
  producedIn: ReturnType<typeof docStep>;
  implementedBy: string[];
  activity: {
    id: string;
    statement: string;
    why: string;
    what: string;
    leanBar: string[];
    tips: string[];
    records: string[];
    clauses: ClauseMap[];
  } | null;
  /** documents this step consumes — they should already exist */
  inputs: { id: string; title: string }[];
  /** drafted alongside this one; don't duplicate their content */
  siblings: { id: string; title: string }[];
  device: { modules: string[]; route: string | null };
  contract: SkeletonFacts;
  /**
   * Placeholders that survive the guidance deletion — i.e. the ones the agent
   * will actually be looking at. `contract.placeholders` counts the whole
   * blank, including the manual table it is told to delete, so using it here
   * asks an agent to fill tokens that cannot exist by then.
   */
  fillPoints: Record<string, number>;
  html: string;
};

/** The blank fragment for a document id. */
export function templateHtml(docId: string): string {
  return readFileSync(
    join(process.cwd(), "content", "docs", `${docId}.html`),
    "utf-8",
  );
}

function docRole(activityDocuments: string | undefined, docId: string): string {
  const g = docWorkflow(activityDocuments);
  if (g.adopt.some((d) => d.id === docId)) return "procedure to adopt";
  if (g.templates.some((d) => d.id === docId)) return "deliverable template";
  if (g.record.some((d) => d.id === docId)) return "record form";
  if (g.registers.some((d) => d.id === docId)) return "register";
  return "document";
}

const titled = (ids: string[]) =>
  ids.map((id) => ({ id, title: byDocId[id]?.title ?? "" })).filter((d) => d.title);

export function buildPromptVars(args: {
  docId: string;
  activityId?: string;
  profile: ScopeProfile;
}): PromptVars | null {
  const doc = byDocId[args.docId];
  if (!doc) return null;

  const step = docStep(args.docId);
  const implementedBy = docActivities(args.docId);
  // Prefer the caller's activity; otherwise the first that produces this doc.
  const activityId = args.activityId ?? implementedBy[0] ?? step?.s ?? "";
  const a = activityId ? getActivity(activityId) : undefined;

  // The process model knows what this step consumes and produces alongside.
  const model = getProcessModel();
  const pstep = step
    ? model.processes.find((p) => p.id === step.p)?.steps.find((s) => s.id === step.s)
    : undefined;

  const html = templateHtml(args.docId);
  const contract = deriveSkeleton(html, args.docId);

  return {
    doc,
    // A PRO-FORMA is a blank an organisation clones to CREATE a document —
    // DOC-TPL-01 ("[Procedure Title] - [DOMAIN]-SOP-NN") is the SOP pro-forma.
    // Its placeholders are the deliverable, not gaps to close: filling them
    // produces one instance and destroys the master. Class alone cannot tell
    // you this — both are TPL — but the blank says so plainly by putting a
    // placeholder where its own identity belongs.
    fillMode: isProForma(args.docId) ? "scaffold" : fillModeFor(doc.cls),
    role: docRole(a?.documents, args.docId),
    producedIn: step,
    implementedBy,
    activity: a
      ? {
          id: a.id,
          statement: a.statement,
          why: a.why ?? "",
          what: a.what ?? "",
          leanBar: a.lean?.startDetail ?? (a.lean?.start ? [a.lean.start] : []),
          tips: a.tips ?? [],
          records: a.records ?? [],
          clauses: a.clausemap ?? [],
        }
      : null,
    inputs: titled(pstep?.consumes ?? []),
    siblings: titled((pstep?.produces ?? []).filter((d) => d !== args.docId)),
    device: {
      modules: args.profile ? Object.keys(args.profile) : [],
      route: euRoute(args.profile),
    },
    contract,
    fillPoints: deriveSkeleton(stripGuidance(html), args.docId).placeholders,
    html,
  };
}

/** The activity's clause map, flattened — what the validator will permit. */
export function allowedClauses(clauses: ClauseMap[]): string[] {
  return clauses.flatMap((c) => c.refs.map((r) => `${c.std} ${r}`.trim()));
}

export { expandRefs };
