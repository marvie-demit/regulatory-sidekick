"use server";

import {
  CHANGELOG_CONSENT,
  normaliseEmail,
  parseAnswers,
  type ReadinessResult,
} from "./assessment";
import { takeReadinessSlot } from "./ratelimit";
import { score } from "./score";
import { saveLead } from "./store";

export type ReadinessRes = {
  error?: string;
  result?: ReadinessResult;
  /** Where the result lives permanently, so it can be sent to someone. */
  token?: string;
  /** False when the lead could not be stored — the score is still returned. */
  stored?: boolean;
  /** True when the rate limiter is why nothing was stored. Different copy. */
  limited?: boolean;
  /** The changelog was asked for and is awaiting confirmation by email. */
  consentPending?: boolean;
};

/**
 * The email gate: score the questionnaire, store the lead, return the result.
 *
 * The scoring deliberately happens HERE and not in the browser. Rung 1 exists to
 * produce an artefact a founder forwards to an investor (BUSINESS-MODEL.md §6.3),
 * and a figure computed client-side is a figure the sender can edit on the way
 * out. The questionnaire posts its state as one JSON field and parseAnswers()
 * re-derives every value from an allowlist, so nothing reaches the scorer that
 * the questionnaire could not have produced.
 *
 * It returns the result even when the insert fails. The respondent answered
 * twenty questions; withholding their score because our lead capture broke
 * punishes them for our outage. The same holds when the rate limiter refuses
 * the write — see lib/readiness/ratelimit.ts for why that only costs them the
 * permanent link.
 */
export async function submitAssessment(
  _prev: ReadinessRes,
  formData: FormData,
): Promise<ReadinessRes> {
  const email = normaliseEmail(formData.get("email"));
  if (!email) return { error: "That doesn't look like an email address." };

  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("answers") ?? "{}"));
  } catch {
    return { error: "Your answers didn't come through. Please try again." };
  }
  if (!raw || typeof raw !== "object")
    return { error: "Your answers didn't come through. Please try again." };

  const answers = parseAnswers(raw);
  const result = score(answers);

  // Checked after scoring and before the write, so a refused caller still gets
  // the thing they came for. Scoring is pure and in-process; it is the row that
  // is worth protecting.
  if (!(await takeReadinessSlot()))
    return { result, stored: false, limited: true };

  const consentRequested = String(formData.get("changelog") ?? "") === "on";
  const { token, stored, consentToken } = await saveLead({
    email,
    answers,
    result,
    consentRequested,
    consentText: consentRequested ? CHANGELOG_CONSENT : null,
  });

  return {
    result,
    token,
    stored,
    // Only claim a pending subscription when the confirmation token actually
    // reached the database. Otherwise there is no link anyone could ever click.
    consentPending: Boolean(consentToken),
  };
}
