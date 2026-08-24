import { createClient } from "@/lib/supabase/server";
import { APPLICATION_COLS, type StartupApplication } from "@/lib/startup/application";

// Server-only reads for the Startup Programme application.
//
// Split from ./application.ts so that file stays importable from a client
// component: the form needs LIMITS and the euro/date helpers, and pulling the
// Supabase server client along with them breaks the browser bundle.

/**
 * The live application for a workspace, if any.
 *
 * Read through the CALLER's client, not the service role: `sa_select` already
 * restricts this to members of the org, so RLS is doing the authorisation and
 * this cannot leak another workspace's application even if a caller passes the
 * wrong id.
 *
 * "Live" mirrors the partial unique index in 0021 — a declined application is
 * deliberately NOT returned, so the pricing card offers a fresh start rather
 * than showing a dead end forever.
 */
export async function getLiveApplication(
  orgId: string,
): Promise<StartupApplication | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("startup_applications")
    .select(APPLICATION_COLS)
    .eq("org_id", orgId)
    .in("status", ["draft", "submitted", "approved"])
    .maybeSingle();
  return (data as StartupApplication | null) ?? null;
}

/** The most recent application whatever its state — for showing a decision. */
export async function getLatestApplication(
  orgId: string,
): Promise<StartupApplication | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("startup_applications")
    .select(APPLICATION_COLS)
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as StartupApplication | null) ?? null;
}
