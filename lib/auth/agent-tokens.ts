// Shared, CLIENT-SAFE definitions for agent (machine) access.
// No imports from supabase/* here — this module is pulled into the browser
// bundle by the settings UI. Database reads live in agent-tokens-read.ts.

// Agent tokens are machine credentials for a workspace, not seats — they don't
// consume the human SEAT_LIMIT, but they are capped so a workspace can't
// accumulate forgotten keys.
export const AGENT_TOKEN_LIMIT = 3;
export const AGENT_TOKEN_TTL_DAYS = 90;

export type AgentScope = "read" | "write:status";

export const SCOPE_LABELS: Record<AgentScope, string> = {
  read: "Read the roadmap, progress and activity detail",
  "write:status": "Update activity status and tick sub-tasks",
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
};
