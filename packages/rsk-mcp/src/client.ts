// The Regulatory Sidekick REST client.
//
// Two behaviours here are not incidental:
//
//  · Cross-host redirects are REFUSED rather than followed. AGENT_API.md
//    documents that the vercel.app host 308-redirects to the custom domain and
//    HTTP clients drop the Authorization header across hosts, so a perfectly
//    valid key arrives as "Missing bearer token". Following it silently turns a
//    config mistake into a baffling auth error; refusing it names the fix.
//
//  · Every status maps to prose the model can act on. A model that sees "402"
//    will guess; one that sees "the agent subscription has lapsed" will stop and
//    tell the user, which is what we want it to do.

export const DEFAULT_BASE_URL = "https://regulatory-sidekick.notjustany.tech";

export class RskError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly detail?: unknown,
  ) {
    super(message);
  }
}

export type ClientConfig = { apiKey: string; baseUrl: string; version: string };

function explain(status: number, body: Record<string, unknown>): string {
  const entitlement = body.entitlement === "agentic";
  const pending = body.status === "pending";
  const scopes = Array.isArray(body.scopes) ? (body.scopes as string[]) : null;
  const server = typeof body.error === "string" ? body.error : "";

  switch (status) {
    case 401:
      return `${server || "The key was not accepted."} Create a new key on the Agent page — keys expire after 90 days and can be revoked.`;
    case 402:
      return entitlement
        ? "Agent access is not switched on for this workspace, or the subscription has lapsed. The licence itself is unaffected. Stop here and tell the user to resubscribe on the Agent page."
        : "This workspace does not have full access. Stop here and tell the user.";
    case 403:
      if (pending)
        return "This key is waiting for a workspace admin to approve it. Nothing will work until they do.";
      // Name the box to tick rather than the scope string: the person who has
      // to act is looking at a form on the Agent page, not at this vocabulary.
      // Scopes are opt-in per key and cannot be added to an existing one, so
      // the answer is always a NEW key, never "grant me this".
      if (scopes) {
        const has = new Set(scopes);
        const missing = [
          !has.has("read:documents") &&
            '"Let the agent fetch document templates"',
          !has.has("write:drafts") && '"Report which documents it has drafted"',
          !has.has("write:status") && '"Update progress"',
        ].filter(Boolean);
        return (
          `This key lacks a required permission (it has: ${scopes.join(", ")}). ` +
          (missing.length
            ? `Ask a workspace admin for a new key on the Agent page with ${missing.join(" / ")} ticked.`
            : "Ask a workspace admin to re-issue it.")
        );
      }
      return `${server || "Refused."} If you tried to set Done or N-A: an agent cannot close or exclude an activity. Report what you drafted and let a person decide.`;
    case 404:
      return server || "Not found — or outside this device's profile, which is the same thing from here.";
    case 429:
      return `${server || "Over budget."} Honour Retry-After. Stop working, report what you completed, and say when it resets — do not retry in a loop.`;
    case 503:
      return "The server could not verify the key. Retry once; if it fails again, stop.";
    default:
      return server || `Request failed (${status}).`;
  }
}

export function createClient(cfg: ClientConfig) {
  const base = cfg.baseUrl.replace(/\/$/, "");

  async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
    const url = `${base}${path}`;
    let res: Response;
    try {
      res = await fetch(url, {
        ...init,
        redirect: "manual",
        headers: {
          Authorization: `Bearer ${cfg.apiKey}`,
          "content-type": "application/json",
          // Lets the platform see which client version a workspace is running,
          // which is how a bad release gets diagnosed from one query.
          "X-RSK-Client": `rsk-mcp/${cfg.version}`,
          ...(init.headers ?? {}),
        },
      });
    } catch (e) {
      throw new RskError(
        `Could not reach ${base}. Check the machine is online and RSK_BASE_URL is right. (${e instanceof Error ? e.message : e})`,
        0,
      );
    }

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      const to = loc ? new URL(loc, base) : null;
      throw new RskError(
        to && to.host !== new URL(base).host
          ? `RSK_BASE_URL points at a host that redirects to ${to.host}. The Authorization header is dropped across hosts, so the key would arrive as "missing". Set RSK_BASE_URL=${to.origin}`
          : `Unexpected redirect from ${url}.`,
        res.status,
      );
    }

    const text = await res.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = { error: text.slice(0, 200) };
    }

    if (!res.ok) {
      const b = (body ?? {}) as Record<string, unknown>;
      const retry = res.headers.get("retry-after");
      throw new RskError(
        explain(res.status, b) + (retry ? ` Retry-After: ${retry}s.` : ""),
        res.status,
        b,
      );
    }
    return body as T;
  }

  return {
    baseUrl: base,
    nextWork: () => call<Record<string, unknown>>("/api/v1/next"),
    activity: (id: string) =>
      call<Record<string, unknown>>(`/api/v1/activities/${encodeURIComponent(id)}`),
    updateProgress: (
      id: string,
      patch: { status?: string; tasks?: Record<string, boolean> },
    ) =>
      call<Record<string, unknown>>(`/api/v1/activities/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    template: (docId: string) =>
      call<TemplateResponse>(
        `/api/v1/documents/${encodeURIComponent(docId)}/template`,
      ),
    /**
     * Report that a draft exists. Path and counts only — deliberately no
     * parameter carries document text, so a future edit here cannot quietly
     * start uploading the customer's QMS.
     */
    reportDraft: (docId: string, d: DraftReport) =>
      call<Record<string, unknown>>(
        `/api/v1/documents/${encodeURIComponent(docId)}/draft`,
        { method: "PUT", body: JSON.stringify(d) },
      ),
  };
}

export type DraftReport = {
  path: string;
  bytes: number;
  ok: true;
  warnings: number;
  openQuestions: number;
  activityId?: string | null;
  client?: string;
};

export type TemplateResponse = {
  id: string;
  title: string;
  cls: string;
  domain: string;
  module: string;
  fillMode: "author" | "scaffold";
  /** activity ids this document implements; the first is the one to report against */
  implementedBy?: string[];
  skeleton: "A" | "B";
  html: string;
  allowedClauses: string[];
  prompt: string;
  contract: Record<string, unknown>;
};

export type Client = ReturnType<typeof createClient>;
