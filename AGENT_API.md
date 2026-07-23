# Agent API (v1)

Machine access to a **workspace** in Regulatory Sidekick, so an AI agent can work
the ISO 13485 / MDR implementation stepwise and report progress back.

## Getting a key

Agent access is a **separate add-on** to the Regulatory Sidekick licence — it is
switched on per workspace by us, not from workspace settings. Until it's on,
every call returns `402`.

1. A member of the workspace opens **Settings → Organization → Agent access** and
   creates a key. The raw key (`rsk_…`) is shown **once** — copy it then.
2. A workspace **admin approves** it. Until then every call returns `403 pending`.
3. Keys expire after 90 days and can be revoked at any time.

Give the key to the agent as `Authorization: Bearer rsk_…`. **The key identifies
the workspace on its own** — never send a workspace/org id; the server derives it
from the key and ignores any id in the request.

Scopes: `read` always; `write:status` only if the creator ticked "Let the agent
update progress".

## Endpoints

Base: `https://regulatory-sidekick.notjustany.tech`

> **Use that host, not `regulatory-sidekick.vercel.app`.** The vercel.app domain
> 308-redirects to the custom domain, and HTTP clients drop the `Authorization`
> header on a cross-host redirect — so a perfectly valid key arrives as
> "Missing bearer token". The in-app "How an agent connects" panel always shows
> the host you are currently on, so copying the URLs from there is safe.

### `GET /api/v1/next` — where we stand, what to do next

```json
{
  "workspace": { "id": "…", "name": "XYZ MedTech", "plan": "full" },
  "deviceProfile": { "configured": true, "modules": ["MDR", "SW"] },
  "progress": { "inScope": 61, "done": 12, "inProgress": 3, "notApplicable": 0, "percent": 20 },
  "currentPhase": { "n": 2, "name": "…", "remaining": 14 },
  "ready":   [ { "id": "RSK.plan", "statement": "…", "blockedBy": [], "detail": "/api/v1/activities/RSK.plan" } ],
  "blocked": [ { "id": "DEV.verify", "blockedBy": ["DEV.plan"] } ],
  "inProgressNow": [ … ]
}
```

Work `ready` top-down — it is ordered exactly like the app's Next-up list
(current phase, wave, then sequence). `blocked` is informational.

### `GET /api/v1/activities/{id}` — how to actually do it

Returns `why`, `what`, `startLean` (the minimum-viable version), `evolve`,
`records`, `tips`, `clauses`, the `documents` (templates) it produces, its
`dependsOn` / `leadsTo`, the `subActivities`, and the flat `tasks` list with the
`index` you need to tick each one.

### `PATCH /api/v1/activities/{id}` — report progress *(needs `write:status`)*

```jsonc
{ "status": "Done" }                        // Not started | In progress | Done | N-A
{ "tasks": { "0": true, "3": true } }       // tick/untick by task index
{ "status": "In progress", "tasks": { "0": true } }
```

Ticking a task on a not-started activity promotes it to **In progress**, exactly
like the UI does.

## Rate limits

Every key has two independent budgets, both set per workspace:

| Budget | Default | What it protects |
| --- | --- | --- |
| Requests / minute | 120 | stops a runaway loop |
| **Writes / day** | 1000 | stops a buggy agent churning quality records |

Only non-`GET` requests count against the write budget. Exceeding either returns
`429` with `Retry-After` (seconds) plus `X-RateLimit-Limit`, `-Remaining` and
`-Reset` (ISO timestamp) — **honour `Retry-After`**; a denied request still
counts, so retrying immediately just keeps you blocked until the window rolls.

Limits are raised by the Regulatory Sidekick team, not from workspace settings.

## Errors

| Status | Meaning |
| --- | --- |
| `401` | missing / unknown / revoked / expired key |
| `402` | no full access, **or** the agent add-on isn't enabled for this workspace |
| `403` | key not approved yet, or missing the required scope |
| `404` | no such activity |
| `429` | over the request or write budget — back off per `Retry-After` |
| `503` | key lookup failed — retry, don't re-auth |

## What the workspace sees

Every write is attributed in the org's **Activity log** to the member who created
the key, tagged `via agent "<name>"`. Admin-approved, scope-limited, revocable,
audited — which is also the access-control story an auditor expects for machine
access to a quality system.
