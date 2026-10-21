// Reads and writes for readiness_leads (migration 0024).
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
  marketingConsent: boolean;
  consentText: string | null;
};

export type SavedLead = { token: string; stored: boolean };

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

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { token, stored: false };
  }

  // Same email, same few minutes: hand back the existing result rather than
  // writing a near-duplicate. Cheap, and it covers the double-click.
  const since = new Date(Date.now() - DEDUPE_SECONDS * 1000).toISOString();
  const { data: recent } = await admin
    .from("readiness_leads")
    .select("token")
    .eq("email", input.email)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (recent?.token) return { token: recent.token as string, stored: true };

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
    marketing_consent: input.marketingConsent,
    consent_text: input.consentText,
  });

  return { token, stored: !error };
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
