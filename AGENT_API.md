# Agent API (v1)

Machine access to a **workspace** in Regulatory Sidekick, so an AI agent can work
the ISO 13485 / MDR implementation stepwise and report progress back.

## Getting a key

Agent access is a **separate add-on** to the Regulatory Sidekick licence — it is
switched on per workspace by us, not from workspace settings. Until it's on,
every call returns `402`.

1. A member of the workspace opens **Agent** in the sidebar and creates a key.
   The raw key (`rsk_…`) is shown **once** — copy it then.
2. A key created by a **member** must be approved by a workspace **admin**;
   until then every call returns `403 pending`. A key created by an admin is
   active immediately.
3. Keys expire after 90 days and can be revoked at any time.

Give the key to the agent as `Authorization: Bearer rsk_…`. **The key identifies
the workspace on its own** — never send a workspace/org id; the server derives it
from the key and ignores any id in the request.

Scopes are opt-in per key, ticked at creation. They **cannot be added to an
existing key** — a key that lacks one has to be replaced, which is why the
`403` names the box to tick rather than the scope string.

| Scope | Box on the Agent page | Grants |
| --- | --- | --- |
| `read` | always on | the roadmap, progress, activity detail |
| `read:documents` | *Let the agent fetch document templates* | the blank template, its contract and its drafting prompt |
| `write:status` | *Let the agent update progress* | `Not started` / `In progress` and task ticks |
| `write:drafts` | *Report which documents it has drafted* | recording that a draft exists — path and counts, never content |

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
{ "status": "In progress" }                 // Not started | In progress — only these two
{ "tasks": { "0": true, "3": true } }       // tick/untick by task index
{ "status": "In progress", "tasks": { "0": true } }
```

Ticking a task on a not-started activity promotes it to **In progress**, exactly
like the UI does.

**An agent cannot set `Done` or `N-A`** — both return `403`. Closing an activity
is a named person taking responsibility, and `N-A` is stronger still: it declares
a regulatory requirement inapplicable to this device. Both are *closed* states, so
either one unblocks dependent activities and moves the workspace's completion
percentage. Report what you did and let a human close it in the app.

### `GET /api/v1/documents/{docId}/template` — the blank *(needs `read:documents`)*

The blank fragment, the contract derived from it, and the prompt for drafting
it — one call. Returns `html`, `fillMode` (`author` or `scaffold`), `contract`
(the header band, outline, placeholders and table shapes a draft must preserve),
`allowedClauses`, and `prompt`.

`fillMode` decides what you are allowed to write. **`scaffold` means leave every
`[ ]` untouched** — filling a form in advance fabricates a quality record.

A document outside this workspace's device profile returns `404`, not `403`: a
`403` would confirm what exists outside the profile.

### `PUT /api/v1/documents/{docId}/draft` — report a draft *(needs `write:drafts`)*

```jsonc
{
  "path": "20_Drafts/AES/AES-SOP-01.html",  // relative to the QMS root, forward slashes
  "bytes": 5119,
  "ok": true,                                // only a draft that passes its contract
  "warnings": 0,
  "openQuestions": 1,
  "activityId": "AES.setup"                  // optional; inferred if omitted
}
```

**Metadata only.** There is no field for document text and no column to store it
— the document stays on the machine that drafted it. `path` must sit under
`20_Drafts/`; anything else is `400`.

`ok` is your report, not something the server can check — it never sees the
draft. Sending `ok: false` returns `422` and writes no row. The real gate is
local: a draft that fails validation is never written to disk, so it has no path
to report.

Re-drafting the same document **updates in place** rather than adding a row. The
history lives in the audit log.

### `GET /api/v1/documents/drafts` — what this workspace has drafted *(needs `read`)*

```jsonc
{
  "available": true,
  "drafts": [
    { "docId": "AES-SOP-01", "activityId": "AES.setup",
      "path": "20_Drafts/AES/AES-SOP-01.html",
      "bytes": 5119, "openQuestions": 1, "warnings": 0,
      "draftedAt": "2026-08-13T09:17:26Z", "reviewed": true }
  ]
}
```

Read it **before drafting**. A local folder is one machine's view: a colleague
drafting on their laptop leaves nothing on yours, so re-drafting would overwrite
work you cannot see. `reviewed: true` means a human has read it — treat that as
a stop sign, not a starting point.

`available: false` means the deployment has no draft registry yet. Drafting
still works; the workspace just will not show it.

Scoped to `read`, not `write:drafts` — reading back what your own workspace
recorded is not a write. Reporting is the privileged half.

### `GET /api/v1/version` — what your client should be running *(no key needed)*

```json
{ "latest": "0.1.0", "minimum": "0.1.0", "package": "@notjustany/regulatory-sidekick-mcp" }
```

Below `latest`: warn, keep working. Below `minimum`: **stop**. That is the kill
switch for a release found to be unsafe — a validator bug that let a falsified
record through, say — and it is the one endpoint that takes no key, precisely so
a client whose key has lapsed can still hear it.

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
| `403` | key not approved yet, missing the required scope, or you tried to set `Done` / `N-A` |
| `404` | no such activity or document — or it is outside this device profile |
| `422` | the draft you reported does not pass its contract — nothing was recorded |
| `429` | over the request or write budget — back off per `Retry-After` |
| `503` | key lookup failed, or draft reporting is not deployed yet — retry, don't re-auth |

## What the workspace sees

Every write is attributed in the org's **Activity log** to the member who created
the key, tagged `via agent "<name>"`. Admin-approved, scope-limited, revocable,
audited — which is also the access-control story an auditor expects for machine
access to a quality system.
