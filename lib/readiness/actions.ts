"use server";

import {
  CHANGELOG_CONSENT,
  normaliseEmail,
  parseAnswers,
  type ReadinessResult,
} from "./assessment";
import { score } from "./score";
import { saveLead } from "./store";

export type ReadinessRes = {
  error?: string;
  result?: ReadinessResult;
  /** Where the result lives permanently, so it can be sent to someone. */
  token?: string;
  /** False when the lead could not be stored — the score is still returned. */
  stored?: boolean;
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
 * punishes them for our outage.
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

  const marketingConsent = String(formData.get("changelog") ?? "") === "on";
  const { token, stored } = await saveLead({
    email,
    answers,
    result,
    marketingConsent,
    consentText: marketingConsent ? CHANGELOG_CONSENT : null,
  });

  return { result, token, stored };
}
