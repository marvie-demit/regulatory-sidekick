# Agent API (v1)

Machine access to a **workspace** in Regulatory Sidekick, so an AI agent can work
the ISO 13485 / MDR implementation stepwise and report progress back.

## Getting a key

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

Base: `https://regulatory-sidekick.vercel.app`

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

## Errors

| Status | Meaning |
| --- | --- |
| `401` | missing / unknown / revoked / expired key |
| `402` | the workspace doesn't have full access |
| `403` | key not approved yet, or missing the required scope |
| `404` | no such activity |
| `503` | key lookup failed — retry, don't re-auth |

## What the workspace sees

Every write is attributed in the org's **Activity log** to the member who created
the key, tagged `via agent "<name>"`. Admin-approved, scope-limited, revocable,
audited — which is also the access-control story an auditor expects for machine
access to a quality system.
