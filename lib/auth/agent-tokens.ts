// Shared, CLIENT-SAFE definitions for agent (machine) access.
// No imports from supabase/* here — this module is pulled into the browser
// bundle by the settings UI. Database reads live in agent-tokens-read.ts.

// Agent tokens are machine credentials for a workspace, not seats — they don't
// consume the human SEAT_LIMIT, but they are capped so a workspace can't
// accumulate forgotten keys.
export const AGENT_TOKEN_LIMIT = 3;
export const AGENT_TOKEN_TTL_DAYS = 90;

// Default budgets per key. A workspace can be given its own ceiling by the
// PLATFORM admin (organizations.agent_rate_limit / agent_write_limit) — never
// by the workspace itself, or the ceiling means nothing.
//
// 120 req/min is generous: an agent reading /next and walking activities won't
// approach it. Writes/day is the one that bites — an honest full pass over the
// roadmap is ~400-500 writes, so a loop trips this long before it can churn a
// customer's quality records.
export const DEFAULT_AGENT_RATE_LIMIT = 120; // requests / minute
export const DEFAULT_AGENT_WRITE_LIMIT = 1000; // writes / day

export type AgentScope =
  | "read"
  | "read:documents"
  | "write:status"
  | "write:drafts";

/** Every scope a key may hold. Kept in step with migration 0019's CHECK. */
export const ALL_SCOPES: AgentScope[] = [
  "read",
  "read:documents",
  "write:status",
  "write:drafts",
];

// These strings are the consent text on the checkboxes a member ticks when
// creating a key, so they must describe what the key can ACTUALLY do. The API
// rejects Done / N-A from an agent (app/api/v1/activities/[id]/route.ts), and
// the label has to say so.
export const SCOPE_LABELS: Record<AgentScope, string> = {
  read: "Read the roadmap, progress and activity detail",
  "read:documents":
    "Fetch blank document templates so it can draft them (every fetch is logged)",
  "write:status":
    "Set activities to In progress and tick sub-tasks (it cannot close or exclude one)",
  // Says "which" and not "what" deliberately: the row records a path, a size
  // and a count of open questions. The document itself never leaves the
  // machine, and the consent text must not imply otherwise.
  "write:drafts":
    "Report which documents it has drafted — the path and size only, never their contents",
};

/** Short form for the keys table. */
export const SCOPE_SHORT: Record<AgentScope, string> = {
  read: "read",
  "read:documents": "templates",
  "write:status": "update progress",
  "write:drafts": "report drafts",
};

export type AgentTokenStatus = "pending" | "active" | "revoked";

export type AgentToken = {
  id: string;
  name: string;
  prefix: string;
  scopes: AgentScope[];
  status: AgentTokenStatus;
  createdByEmail: string;
  createdByYou: boolean;
  approvedByEmail: string | null;
  approvedAt: string | null;
  lastUsedAt: string | null;
  expiresAt: string;
  expired: boolean;
  createdAt: string;
  /** budget usage — display only; the workspace can see it, never change it */
  rateUsed: number;
  writeUsed: number;
};
