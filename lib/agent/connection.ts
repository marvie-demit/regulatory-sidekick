// "Has an agent ever actually connected to this workspace?"
//
// Pure — derived from the tokens the page has already fetched, so this costs
// ZERO extra queries. last_used_at is stamped by consume_agent_quota on every
// authenticated request (lib/api/agent-auth.ts), so it is the honest signal:
// a key that exists but has never been used means setup was never finished.

import type { AgentToken } from "@/lib/auth/agent-tokens";

export type AgentConnection = {
  /** any key has been used at least once */
  everConnected: boolean;
  /** most recent use across all keys, revoked ones included */
  lastUsedAt: string | null;
  /** approved, unexpired keys — the ones that would work right now */
  activeKeys: number;
  /** created but not yet approved — a silent blocker that looks like inaction */
  pendingKeys: number;
  /** live keys of any status, for the per-workspace cap */
  liveKeys: number;
};

export function agentConnection(tokens: AgentToken[]): AgentConnection {
  let lastUsedAt: string | null = null;
  let activeKeys = 0;
  let pendingKeys = 0;
  let liveKeys = 0;

  for (const t of tokens) {
    // ISO-8601 sorts lexicographically, so no Date allocation per token.
    if (t.lastUsedAt && (!lastUsedAt || t.lastUsedAt > lastUsedAt))
      lastUsedAt = t.lastUsedAt;
    if (t.status !== "revoked") liveKeys++;
    if (t.status === "active" && !t.expired) activeKeys++;
    if (t.status === "pending") pendingKeys++;
  }

  return {
    everConnected: lastUsedAt !== null,
    lastUsedAt,
    activeKeys,
    pendingKeys,
    liveKeys,
  };
}

/** "3 days ago" / "just now" — for a value measured in hours and days. */
export function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return "just now";
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 31) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? "" : "s"} ago`;
}
