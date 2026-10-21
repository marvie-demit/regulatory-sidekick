// Rate limiting for the one unauthenticated action in the app that writes rows
// (lib/readiness/actions.ts). SERVER ONLY — it holds the service role.
//
// See migration 0025 for why the bucket stores a hash rather than an address.

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * How much is "obviously not a person filling in a questionnaire".
 *
 * Ten an hour per address, not one: an accelerator running the assessment
 * across a cohort in one room shares an outbound address, and a limiter that
 * breaks the §6.7 motion it exists to protect is the wrong trade. A script can
 * still burn ten rows an hour; it cannot fill a table.
 */
const MAX_PER_WINDOW = 10;
const WINDOW_SECONDS = 60 * 60;

/**
 * The client address, as the proxy in front of us reports it.
 *
 * Leftmost `x-forwarded-for`, which is what Vercel normalises the client to.
 * Returns null in local development, where neither header is set.
 */
async function clientIp(): Promise<string | null> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (fwd) return fwd;
  return h.get("x-real-ip")?.trim() || null;
}

/**
 * Salt for the address hash.
 *
 * `READINESS_IP_SALT` if it is set; otherwise the service-role key, which is
 * necessarily present wherever this code can write at all. Falling back means
 * the limiter works the moment 0025 is applied rather than silently doing
 * nothing until somebody remembers a second variable — the failure mode
 * OPERATIONS.md is full of. Set the dedicated variable if you would rather not
 * reuse the key for two purposes; rotating it simply empties every bucket.
 */
function salt(): string | null {
  return (
    process.env.READINESS_IP_SALT ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    null
  );
}

async function ipHash(): Promise<string | null> {
  const ip = await clientIp();
  const s = salt();
  if (!ip || !s) return null;
  return createHash("sha256").update(`${s}:${ip}`).digest("hex");
}

/**
 * Claim one slot. True means proceed.
 *
 * FAILS OPEN, on purpose, in every degraded case — no address available, no
 * salt, no service role, migration not applied, database unreachable. This
 * limiter protects the quality of a lead list, not access to anything: a bug or
 * an outage in it must not stop a founder who answered twenty questions from
 * seeing their score. The cost of failing open is spam in a table we can prune;
 * the cost of failing closed is the product looking broken to exactly the
 * person it was built for.
 */
export async function takeReadinessSlot(): Promise<boolean> {
  const hash = await ipHash();
  if (!hash) return true;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("readiness_rate_take", {
      p_ip_hash: hash,
      p_max: MAX_PER_WINDOW,
      p_window_seconds: WINDOW_SECONDS,
    });
    if (error) return true;
    return data !== false;
  } catch {
    return true;
  }
}
