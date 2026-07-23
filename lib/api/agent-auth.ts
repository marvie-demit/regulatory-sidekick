import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasFullAccess } from "@/lib/auth/access";
import type { AgentScope } from "@/lib/auth/agent-tokens";

// ============================================================================
// THE choke point for machine access.
//
// An agent has no Supabase user session, so RLS-via-JWT can't be the wall here:
// this module resolves the bearer token with the service role and hands the
// route an org_id it did NOT get from the caller. Two rules keep that safe and
// they must never be broken:
//
//   1. org_id ALWAYS comes from the token row. A request body / query string /
//      header naming an organization is ignored — there is no code path that
//      reads one.
//   2. Every /api/v1 route goes through withAgentAuth(). No route may create
//      its own admin client.
//
// (Hardening path if this ever grows: mint a short-lived per-org Supabase JWT
// here so RLS applies to agent traffic too.)
// ============================================================================

export type AgentCtx = {
  tokenId: string;
  tokenName: string;
  orgId: string;
  orgName: string;
  plan: string;
  /** the member who created the key — agent actions are attributed to them */
  createdBy: string;
  scopes: AgentScope[];
  /** service-role client; only ever used with orgId above */
  db: ReturnType<typeof createAdminClient>;
};

function fail(status: number, error: string, extra?: Record<string, unknown>) {
  const res = NextResponse.json({ error, ...extra }, { status });
  if (status === 401)
    res.headers.set("WWW-Authenticate", 'Bearer realm="regulatory-sidekick"');
  return res;
}

function bearer(req: Request): string | null {
  const h = req.headers.get("authorization") || "";
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  return m ? m[1].trim() : null;
}

// Resolve + authorize. Returns a ctx or the Response to send back.
async function authenticate(
  req: Request,
  need: AgentScope,
): Promise<{ ctx: AgentCtx } | { res: NextResponse }> {
  const raw = bearer(req);
  if (!raw)
    return {
      res: fail(401, "Missing bearer token.", {
        hint: "Send Authorization: Bearer rsk_…",
      }),
    };

  const tokenHash = createHash("sha256").update(raw).digest("hex");
  const db = createAdminClient();

  const { data, error } = await db
    .from("agent_tokens")
    .select(
      "id, name, org_id, scopes, status, created_by, expires_at, organizations(name, plan, plan_expires_at)",
    )
    .eq("token_hash", tokenHash)
    .maybeSingle();

  // A lookup failure must not read as "bad token" — that would send an agent
  // into a pointless re-auth loop during an outage.
  if (error) return { res: fail(503, "Could not verify the key. Retry.") };
  if (!data) return { res: fail(401, "Unknown or revoked key.") };

  const row = data as unknown as {
    id: string;
    name: string;
    org_id: string;
    scopes: string[];
    status: string;
    created_by: string;
    expires_at: string;
    organizations:
      | { name: string; plan: string; plan_expires_at: string | null }
      | { name: string; plan: string; plan_expires_at: string | null }[]
      | null;
  };

  if (row.status === "pending")
    return {
      res: fail(403, "This key is waiting for admin approval.", {
        status: "pending",
      }),
    };
  if (row.status !== "active") return { res: fail(401, "This key was revoked.") };
  if (new Date(row.expires_at).getTime() < Date.now())
    return { res: fail(401, "This key has expired. Create a new one.") };

  const org = Array.isArray(row.organizations)
    ? row.organizations[0]
    : row.organizations;
  if (!org) return { res: fail(404, "Workspace not found.") };

  // Effective plan — a lapsed grant falls back to explore, same rule as the UI.
  const lapsed =
    !!org.plan_expires_at && new Date(org.plan_expires_at) < new Date();
  const plan = lapsed ? "explore" : (org.plan ?? "explore");
  if (!hasFullAccess(plan))
    return { res: fail(402, "This workspace doesn't have full access.") };

  const scopes = (row.scopes || []) as AgentScope[];
  if (!scopes.includes(need))
    return {
      res: fail(403, `This key doesn't have the "${need}" permission.`, {
        scopes,
      }),
    };

  return {
    ctx: {
      tokenId: row.id,
      tokenName: row.name,
      orgId: row.org_id,
      orgName: org.name,
      plan,
      createdBy: row.created_by,
      scopes,
      db,
    },
  };
}

// Wrap a route handler: authenticate, enforce scope, run, stamp last-used.
// `R` carries Next's route context (e.g. { params }) through untouched.
export function withAgentAuth<R = unknown>(
  need: AgentScope,
  handler: (ctx: AgentCtx, req: Request, route: R) => Promise<NextResponse>,
) {
  return async (req: Request, route: R): Promise<NextResponse> => {
    const auth = await authenticate(req, need);
    if ("res" in auth) return auth.res;
    const { ctx } = auth;
    let res: NextResponse;
    try {
      res = await handler(ctx, req, route);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unexpected error.";
      res = fail(500, msg);
    }
    // Best-effort "last seen" — never let it break the response.
    try {
      await ctx.db
        .from("agent_tokens")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", ctx.tokenId);
    } catch {}
    return res;
  };
}

// Agent writes are attributed to the member who created the key, with the agent
// named in the detail — so the org's Activity log reads
// "Marvie · via agent 'Claude implementation agent'".
export async function auditAgent(
  ctx: AgentCtx,
  action: string,
  entityType: string,
  entityId: string | null,
  detail?: Record<string, unknown>,
) {
  try {
    await ctx.db.from("audit_log").insert({
      org_id: ctx.orgId,
      actor_id: ctx.createdBy,
      action,
      entity_type: entityType,
      entity_id: entityId,
      detail: { ...(detail ?? {}), via: "agent", agent: ctx.tokenName },
    });
  } catch {}
}

export { fail as agentError };
