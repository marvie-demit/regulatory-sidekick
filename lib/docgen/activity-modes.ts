// What KIND of work an activity is, from the agent's point of view.
//
// 85 of the 116 activities produce controlled documents; those are `author`.
// The other 31 split two ways, and **that split cannot be derived from the
// data** — nothing in content.json marks "this is an act in the world". Hence a
// curated list, reviewed once with a QARA eye, rather than a model re-inferring
// it every session.
//
// The distinction is not cosmetic. In `handoff` the agent must tick NOTHING:
// "Appoint the management representative" is complete when a person has been
// appointed, not when a note has been written about appointing one. A model
// left to judge that for itself will reason its way to "well, I documented it".

import { getActivity } from "@/lib/content/content";

export type ActivityMode = "author" | "assist" | "handoff";

/**
 * Activities that are an ACT, not a document. The agent briefs and stops.
 *
 * Three families:
 *  · a person is appointed, or a contract is signed          (QMN.qmr, TEF.nb)
 *  · an external event happens to you                        (the NB audits, TEF.cdx)
 *  · it needs real data from the real world                  (studies, field data, suppliers)
 *
 * REVIEW THIS LIST with a QARA eye before it ships — it is judgment encoded as
 * data, and the cost of a wrong entry is an agent ticking off work nobody did.
 */
export const HANDOFF_ACTIVITIES: readonly string[] = [
  // — someone is appointed, or a commercial relationship is entered into
  "QMN.qmr", // Appoint the management representative
  "TEF.nb", // Engage a Notified Body: contract and review slot

  // — an external body does something to you, on their schedule
  "TEF.certify.stage1", // Notified Body Stage 1
  "TEF.certify.stage2", // Notified Body Stage 2 — on-site audit
  "TEF.cdx", // Companion diagnostic: medicinal-authority consultation

  // — a named person takes responsibility, in writing
  "RSK.signoff", // Sign off the risk-management report
  "DEV.transfer", // Transfer the design to production

  // — requires real subjects, real samples or real field data. An agent that
  //   "completes" any of these has invented evidence, which is rule 1.
  "HUF.formative", // formative usability evaluations, with real users
  "PEV.feasibility", // feasibility / proof-of-concept study
  "PEV.selftest", // validate performance with lay users
  "CAP.operate", // running the CAPA loop, not defining it
  "PUR.surveil", // supplier surveillance & re-evaluation
  "RSK.postmarket", // feeding post-market data back into the risk file
];

/**
 * `assist` activities produce no controlled document but real written work —
 * a Markdown note in 20_Drafts/_working/, not an HTML fragment, because there
 * is no skeleton to validate against.
 *
 * Several of these the agent does unusually well, because the product already
 * holds the data: TEF.stdlist is derivable from the device profile plus the 14
 * clause-mapped standards, and DEV.trace from the dependency graph. Those are
 * near-zero-invention outputs.
 */
export function activityMode(activityId: string): ActivityMode {
  if (HANDOFF_ACTIVITIES.includes(activityId)) return "handoff";
  const a = getActivity(activityId);
  const docs = (a?.documents ?? "").trim();
  return docs && docs !== "-" ? "author" : "assist";
}

/** One line the prompt and the API can both use, so they cannot disagree. */
export const MODE_GUIDANCE: Record<ActivityMode, string> = {
  author:
    "Draft the controlled documents this activity produces, each as an HTML fragment against its skeleton.",
  assist:
    "No controlled document exists for this activity. Write a Markdown working note to 20_Drafts/_working/<activityId>.md — what it requires, what you worked out, and what the human still has to decide.",
  handoff:
    "This is something a person does, not something you write. Explain what it requires and what evidence it will produce, then stop. Tick nothing: it is complete when the act happens, not when a note about it exists.",
};
