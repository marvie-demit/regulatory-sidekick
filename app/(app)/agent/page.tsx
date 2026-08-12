import Link from "next/link";
import { headers } from "next/headers";
import { getActiveOrg } from "@/lib/auth/org";
import { hasAgenticAccess, hasFullAccess } from "@/lib/auth/access";
import { getAgentTokens } from "@/lib/auth/agent-tokens-read";
import {
  AGENT_TOKEN_LIMIT,
  AGENT_TOKEN_TTL_DAYS,
  DEFAULT_AGENT_RATE_LIMIT,
  DEFAULT_AGENT_WRITE_LIMIT,
} from "@/lib/auth/agent-tokens";
import { agentConnection, timeAgo } from "@/lib/agent/connection";
import { createClient } from "@/lib/supabase/server";
import { LockedNotice } from "@/components/content/LockedNotice";
import { AgentUpsell } from "@/components/agent/AgentUpsell";
import { ConnectPanel } from "@/components/agent/ConnectPanel";
import { CreateKeyForm, KeyList } from "@/components/agent/AgentKeys";

export const metadata = { title: "Agent" };

// Four states, all decided here on the server:
//   1  no licence          → locked, with a real CTA
//   2  licence, no add-on  → the upsell (this is where the add-on is sold)
//   3  add-on, never used  → setup
//   4  connected           → status + keys
//
// This page exists because the old panel could not do states 1 and 2: it was a
// client component, and LockedNotice is server-only (it reads the corpus via
// node:fs). Both were dead ends with nothing to click.

export default async function AgentPage() {
  const org = await getActiveOrg();
  if (!org) return null;

  const supabase = await createClient();
  // Resilient to migrations 0012 / 0013 not being applied — fall back rather
  // than blanking the page, matching settings/organization's step-down reads.
  let res = await supabase
    .from("organizations")
    .select(
      "agent_rate_limit, agent_write_limit, agentic_enabled, agentic_expires_at",
    )
    .eq("id", org.id)
    .single();
  if (res.error)
    res = await supabase.from("organizations").select("id").eq("id", org.id).single();
  const d = (res.data ?? {}) as Record<string, string | number | boolean | null>;

  const isFull = hasFullAccess(org.plan);
  const isEnabled = hasAgenticAccess({
    plan: org.plan,
    agenticEnabled: d.agentic_enabled as boolean | null,
    agenticExpiresAt: d.agentic_expires_at as string | null,
  });

  const rateLimit =
    (d.agent_rate_limit as number | null) ?? DEFAULT_AGENT_RATE_LIMIT;
  const writeLimit =
    (d.agent_write_limit as number | null) ?? DEFAULT_AGENT_WRITE_LIMIT;

  const hdrs = await headers();
  const host = hdrs.get("host") ?? "localhost:3100";
  const baseUrl = `${host.startsWith("localhost") ? "http" : "https"}://${host}`;

  const header = (
    <>
      <h1 className="font-display text-2xl font-semibold text-teal-900">Agent</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        Let an AI assistant work this implementation with you — reading the plan,
        drafting documents into your own folder, and reporting progress back.
      </p>
    </>
  );

  // ---- state 1: no licence -------------------------------------------------
  if (!isFull)
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        {header}
        <div className="mt-6">
          <LockedNotice title="Agent access" />
        </div>
      </main>
    );

  // ---- state 2: licence, no add-on ----------------------------------------
  if (!isEnabled)
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        {header}
        <div className="mt-6">
          <AgentUpsell orgName={org.name} />
        </div>
      </main>
    );

  // Agent access is additive — if migration 0011 isn't applied the read returns
  // [] and the page still renders (creating a key surfaces the real error).
  const tokens = await getAgentTokens(org.id);
  const conn = agentConnection(tokens);
  const isAdmin = org.role === "admin";

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      {header}

      {/* ---- status strip: the honest answer to "is this working?" ---- */}
      <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-line bg-tint px-4 py-3">
        <span
          className="rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide"
          style={
            conn.everConnected
              ? { background: "#e7f0ec", color: "#1d6e62" }
              : { background: "#fdf0e9", color: "#b4471f" }
          }
        >
          {conn.everConnected ? "Connected" : "Not connected yet"}
        </span>
        <span className="text-sm text-muted">
          {conn.everConnected ? (
            <>Last used {timeAgo(conn.lastUsedAt)}</>
          ) : conn.activeKeys ? (
            <>
              {conn.activeKeys} key{conn.activeKeys === 1 ? "" : "s"} ready —
              nothing has connected yet
            </>
          ) : conn.pendingKeys ? (
            <>
              {conn.pendingKeys} key{conn.pendingKeys === 1 ? "" : "s"} waiting
              for an admin to approve
            </>
          ) : (
            <>Create a key to get started</>
          )}
        </span>
      </div>

      {/* ---- keys ---- */}
      <section className="mt-6 rounded-2xl border border-line bg-card p-6 shadow-sm">
        <h2 className="font-display text-lg font-semibold text-teal-900">
          Keys
        </h2>
        <p className="mt-1 text-sm text-muted">
          A key identifies this workspace on its own. Keys expire after{" "}
          {AGENT_TOKEN_TTL_DAYS} days, can be revoked at any time, and every
          action lands in your{" "}
          <Link
            href="/settings/activity"
            className="font-medium text-teal-700 hover:underline"
          >
            Activity log
          </Link>
          . Each is budgeted at {rateLimit} requests/minute and {writeLimit}{" "}
          writes/day, so a looping agent can&apos;t churn your records.
        </p>

        <div className="mt-5">
          <CreateKeyForm
            atLimit={conn.liveKeys >= AGENT_TOKEN_LIMIT}
            isAdmin={isAdmin}
            baseUrl={baseUrl}
            showCommand
          />
        </div>

        <div className="mt-5">
          <KeyList tokens={tokens} isAdmin={isAdmin} writeLimit={writeLimit} />
        </div>
      </section>

      {/* ---- how to connect ---- */}
      <div className="mt-6">
        <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.15em] text-teal-800">
          {conn.everConnected ? "Connect another machine" : "Connect your assistant"}
        </div>
        <ConnectPanel baseUrl={baseUrl} />
      </div>
    </main>
  );
}
