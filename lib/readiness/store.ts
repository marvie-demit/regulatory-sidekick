// Reads and writes for readiness_leads (migrations 0024, 0025).
//
// SERVER ONLY. The write holds the service role, because the table has RLS on
// and no policies — see the header of 0024 for why a lead list gets no customer
// policy and why the public result read is an RPC instead.

import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getRequestPartnerSlug } from "@/lib/partners/brand";
import type { Answers, ReadinessResult } from "./assessment";

/**
 * 32 random bytes, base64url — the identity of a result that will be forwarded.
 *
 * Not a uuid: a uuid in a URL reads like a database id someone might try to
 * enumerate, and 256 bits of entropy costs nothing here.
 */
export function mintToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Resolved from the request host, never from the form. Same rule as 0022. */
async function partnerIdFromRequest(): Promise<string | null> {
  const slug = await getRequestPartnerSlug();
  if (!slug) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("partners")
    .select("id")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

/** Collapse a double-submit instead of minting a second row for it. */
const DEDUPE_SECONDS = 120;

export type SaveLead = {
  email: string;
  answers: Answers;
  result: ReadinessResult;
  /**
   * The changelog box was ticked. NOT consent yet — 0025 only lets
   * readiness_confirm_consent() grant that, once someone opens a link sent to
   * the address. A tick box on a public form says nothing about who owns the
   * address that was typed above it.
   */
  consentRequested: boolean;
  consentText: string | null;
};

export type SavedLead = {
  token: string;
  stored: boolean;
  /**
   * The confirmation token, when one was minted. The link to send is
   * `<origin>/readiness/confirm/<consentToken>`. Null when the box was not
   * ticked, or when nothing could be stored.
   */
  consentToken: string | null;
};

/**
 * Store one completed assessment and return the token its result lives at.
 *
 * `stored: false` means the row could not be written — a missing migration, or
 * an unconfigured service-role key in local development. The caller still shows
 * the result in that case: refusing to show someone their own score because our
 * lead capture failed would be the wrong trade, and the failure is ours.
 */
export async function saveLead(input: SaveLead): Promise<SavedLead> {
  const token = mintToken();
  const consentToken = input.consentRequested ? mintToken() : null;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { token, stored: false, consentToken: null };
  }

  // Same email, same few minutes: hand back the existing result rather than
  // writing a near-duplicate. Cheap, and it covers the double-click.
  const since = new Date(Date.now() - DEDUPE_SECONDS * 1000).toISOString();
  const { data: recent } = await admin
    .from("readiness_leads")
    .select("id, token, consent_state, consent_token")
    .eq("email", input.email)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recent?.token) {
    const row = recent as {
      id: string;
      token: string;
      consent_state: string | null;
      consent_token: string | null;
    };

    // The second submission may be the one that ticked the box. Asking again on
    // the row we are about to hand back costs one update and avoids silently
    // dropping a request the person did make.
    if (consentToken && (row.consent_state ?? "none") === "none") {
      const { error } = await admin
        .from("readiness_leads")
        .update({
          consent_state: "pending",
          consent_token: consentToken,
          consent_requested_at: new Date().toISOString(),
          consent_text: input.consentText,
        })
        .eq("id", row.id);
      if (!error)
        return { token: row.token, stored: true, consentToken };
    }

    return {
      token: row.token,
      stored: true,
      consentToken: row.consent_state === "pending" ? row.consent_token : null,
    };
  }

  const { error } = await admin.from("readiness_leads").insert({
    token,
    email: input.email,
    org_name: input.result.org.name,
    role: input.result.org.role,
    partner_id: await partnerIdFromRequest(),
    answers: input.answers,
    result: input.result,
    overall: input.result.overall,
    band: input.result.band.label,
    route: input.answers.route,
    risk_class: input.answers.riskClass,
    content_hash: input.result.contentHash,
    scorer_version: input.result.scorerVersion,
    // False at insert, always. Only the confirmation flips it.
    marketing_consent: false,
    consent_state: input.consentRequested ? "pending" : "none",
    consent_token: consentToken,
    consent_requested_at: input.consentRequested
      ? new Date().toISOString()
      : null,
    consent_text: input.consentText,
  });

  return {
    token,
    stored: !error,
    consentToken: error ? null : consentToken,
  };
}

/**
 * Turn a pending consent into a real one.
 *
 * Goes through readiness_confirm_consent() on the ordinary anon client for the
 * same reason as the result read: the confirmation page is unauthenticated, and
 * a service-role client there would make any bug on it reach the whole table.
 * The function returns a bare boolean — notably not the address — so a guessed
 * token cannot be turned into a disclosure.
 */
export async function confirmConsent(token: string): Promise<boolean> {
  if (!token || token.length < 20 || token.length > 128) return false;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("readiness_confirm_consent", {
      p_token: token,
    });
    return !error && data === true;
  } catch {
    return false;
  }
}

export type StoredResult = {
  result: ReadinessResult;
  orgName: string | null;
  createdAt: string;
};

/**
 * The public result read, by token.
 *
 * Goes through readiness_result_by_token() on the ordinary anon client, NOT the
 * service role: the function returns the score and the name on it and nothing
 * else, so a bug on the public route cannot reach the lead list. See 0024.
 */
export async function resultByToken(token: string): Promise<StoredResult | null> {
  if (!token || token.length < 20 || token.length > 128) return null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .rpc("readiness_result_by_token", { p_token: token })
      .maybeSingle();
    if (error || !data) return null;
    const row = data as {
      result: ReadinessResult;
      org_name: string | null;
      created_at: string;
    };
    if (!row.result) return null;
    return {
      result: row.result,
      orgName: row.org_name,
      createdAt: row.created_at,
    };
  } catch {
    return null;
  }
}
