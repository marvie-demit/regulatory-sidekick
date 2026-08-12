# Agentic document generation — Specification

> How it works. Readable without opening the codebase.
> For the implementation plan and technical reference, see [BUILD.md](./BUILD.md).

---

## What we are building

Regulatory Sidekick tells a customer **what** to do — 116 sequenced activities — and hands
them **275 blank controlled-document templates**. The gap is the middle: turning *"activity
`RSK.plan` produces `RSK-SOP-01`"* into an actual drafted procedure written in that
company's voice.

An AI agent closes that gap. It reads the plan from Regulatory Sidekick, drafts documents
into a folder on the customer's own machine, and reports back what it did.

### Why now

Everything needed already exists except the middle:

| Already built | Missing |
| --- | --- |
| The 116-activity plan with real dependencies | Any AI/LLM code at all — the repo has none |
| 275 clause-mapped templates | A way for an agent to fetch one |
| Bearer-token API, admin-approved keys, scopes, rate limits, audit trail | The three tools `skills.md` promises but nobody wrote |
| A paid entitlement (`agentic_enabled`) already gated per request | Monthly billing for it |

### Three things the customer needs

| # | What | Who sells it | Status |
| --- | --- | --- | --- |
| 1 | Full access licence — €1,800 / €6,000 one-time | Us | ✅ live |
| 2 | **Agent add-on — monthly subscription** | Us | ⚠️ entitlement exists, billing doesn't |
| 3 | An MCP client (e.g. Claude Code) and their own model | Anthropic | Customer brings it |

We never pay for a token and never generate a word of regulatory content on our servers.
We supply the sequence, the clause map, the skeleton and the validator.

### In one sentence

> The customer's own AI drafts their QMS against our plan, into their own folder, and the
> platform records that it happened — without a single document ever leaving their machine.

### Five things that must stay true

1. **Never invent a fact.** No dates, names, signatures, results, batch numbers.
2. **Forms and registers are scaffolds, never records.** A filled form is a falsified record.
3. **The agent opens work; a human closes it.** Only a person sets `Done`.
4. **Documents never leave the customer's machine.** The platform stores metadata only.
5. **Nothing is written outside `20_Drafts/`.** `00_Controlled/` is read-only by construction.

---

## 1. The shape of it

```
   REGULATORY SIDEKICK (cloud)              CUSTOMER'S MACHINE
   ───────────────────────────              ──────────────────────────
   the plan · 116 activities
   275 templates · clause maps
   progress · audit log
            │      ▲                          ┌──────────────────────┐
            │      │                          │  Claude Code         │
            │      │   MCP server ◄───────────┤  (their subscription)│
            │      │   (local process)        └──────────────────────┘
            ▼      │                                    │
     ┌─────────────┴─────────┐                          ▼
     │ GET  what's next      │                 QMS folder (local)
     │ GET  activity brief   │                 ├── 00_Controlled/  READ ONLY
     │ GET  blank template   │                 ├── 10_Records/     READ ONLY
     │ PUT  draft recorded   │◄────────────────┤ ├── 20_Drafts/    ← everything lands here
     │ PATCH progress        │   metadata      │ ├── QMS-FACTS.yml
     └───────────────────────┘   only          │ ├── OPEN-QUESTIONS.md
                                               └── AGENT-LOG.md
```

The MCP server runs **on the customer's machine**. It holds the API key, talks to the
platform, and is the only thing allowed to write files.

---

## 2. The four modes

Not every activity produces a document. The agent behaves differently depending on what an
activity actually yields — and the mode is sent on the brief, so the model reads its
instruction rather than guessing.

### `author` — draft a controlled document

**184 documents** · classes SOP, WI, TPL, POL, MAN

| | |
| --- | --- |
| **Input** | Activity brief (why / what / start-lean bullets / tasks / clause map) · the blank HTML template · the skeleton contract · anything already in `00_Controlled/` |
| **Action** | Write the document to the *lean bar* — the minimum viable version — in the company's voice, citing only the clauses supplied, marking every unknown as `[[NEEDS INPUT: …]]` |
| **Output** | An HTML fragment in `20_Drafts/`, a metadata record in the platform, entries in `OPEN-QUESTIONS.md`, the activity moved to `In progress` |

### `scaffold` — build an empty structure

**91 documents** · classes FOR (forms), LIS (registers)

| | |
| --- | --- |
| **Input** | Same as `author` |
| **Action** | **Strip guidance, write the scope section, and stop.** Every `[ ]` cell left untouched, no rows added, no dates, no names, no results |
| **Output** | An HTML fragment that is structurally complete and factually empty |

> **Why:** a form records something that happened. Filling one in advance fabricates a
> quality record — the worst thing an agent can do here. The validator enforces it
> mechanically: `[ ]` counts and positions must match the blank exactly.

### `assist` — no document exists, but there is real work

**~19 activities** · e.g. `TEF.stdlist`, `DEV.trace`, `TEF.regstrat`, `CLE.sota`, `DEV.ddplan`

| | |
| --- | --- |
| **Input** | Activity brief · the device profile · the product's own data |
| **Action** | Produce a **Markdown working note**, not HTML — there is no template to validate against |
| **Output** | `20_Drafts/_working/<activityId>.md` · activity `In progress` · **no** platform draft record |

> Not a consolation prize. *"List the applicable legislation and standards"* is derivable
> from the device profile plus our 14 clause-mapped standards. *"Finalise the design
> traceability matrix"* comes out of the dependency graph. These are near-zero-invention
> outputs the agent produces better than a person doing it by hand.

### `handoff` — this is an act, not a document

**~12 activities**

`QMN.qmr` appoint the management representative · `TEF.nb` engage a Notified Body ·
`TEF.certify.stage1` / `stage2` the audits · `RSK.signoff` sign off the risk report ·
`DEV.transfer` design transfer · `TEF.cdx` regulator consultation · `CAP.operate` ·
`RSK.postmarket` · `PUR.surveil` · `HUF.formative` · `PEV.feasibility` · `PEV.selftest`

| | |
| --- | --- |
| **Input** | Activity brief |
| **Action** | Explain what it requires and what evidence it will produce. **Then stop.** |
| **Output** | A briefing. **No file. No ticked tasks. No status change.** |

> *"Appoint the management representative" is complete when a person has been appointed —
> not when a note has been written about appointing one.*

### All 116 activities stay visible

Hiding the 31 without documents would strand the dependency graph: `DEV.vvproc` and
`BIO.proc` each unblock two downstream activities, four others unblock one. Filter them out
and they never close, everything behind them stays blocked, and the agent correctly reports
there is nothing to do.

---

## 3. One activity, end to end

**`RSK.plan` — "RM plan + initial hazards."** Phase 2. Produces five documents.

| Step | What happens |
| --- | --- |
| 1 | Agent asks what's next. `RSK.plan` is top of `ready` |
| 2 | Pulls the brief: why risk management matters, the six *start-lean* bullets, 5 documents, the ISO 14971 clause map, 5 watch-outs |
| 3 | Checks what's already drafted, and reads `00_Controlled/` for existing risk documents and the company's terminology |
| 4 | Asks — **once** — for anything still missing that a person can answer |
| 5 | **`RSK-SOP-01`** (SOP → *author*) — drafts the full procedure: purpose, roles, the process step tables, the clause map |
| 6 | **`RSK-TPL-01`** (TPL → *author*) — drafts the risk-management plan to the lean bar: responsible person, scope, phase timing, the 3×3 acceptability matrix |
| 7 | **`RSK-FOR-01/04/05`** (FOR → *scaffold*) — structure only. **No hazards. No scores. No dates.** |
| 8 | Validates each. Fixes errors. Saves. Reports each to the platform |
| 9 | Logs open questions — *who chairs the risk review board?*, *approval date* |
| 10 | Sets `RSK.plan` to **In progress** and ticks only tasks genuinely completed |
| 11 | Tells the user: 2 drafted, 3 scaffolded, 4 open questions, **ready for your review** |

The customer opens Regulatory Sidekick and sees `RSK.plan · 5 of 5 documents drafted ·
4 open questions`. They review, promote into `00_Controlled/`, and set it **Done**
themselves.

---

## 4. Where everything lives

The data boundary is the promise, so it is worth stating flatly:

| | On our servers | On their machine |
| --- | --- | --- |
| The plan, templates, clause maps | ✅ | — |
| Progress, ticked tasks, audit log | ✅ | — |
| **Draft document text** | ❌ **never** | ✅ |
| Draft metadata — path, checksum, counts, validation | ✅ | — |
| Their controlled documents and records | ❌ never | ✅ |

`skills.md` already promises this — *"the local QMS directory … is the system of record for
content"*. The design keeps it true rather than restating it.

---

## 5. The QMS folder

A plain filesystem path, scaffolded by one command. **We build no Google Drive or OneDrive
integration.** If the customer puts the folder inside a synced drive it simply works — and
often that is how their reviewer sees the drafts at all.

Sync does introduce four failure modes, so the setup check looks for them:

| Hazard | Why it bites | What we do |
| --- | --- | --- |
| **Files On-Demand** | OneDrive shows a file that isn't really on disk — and `00_Controlled/` is the first thing the agent reads | Warn; tell them to mark the folder *Always keep on this device* |
| **Conflict copies** | Two machines make `RSK-SOP-01 (conflicted copy).html` and a reviewer promotes the wrong one | Detect and list them |
| **Half-written files** | The sync client uploads a file mid-write | Write to a temp file, then atomic rename |
| **Locks / long paths** | Client holds the file; Windows 260-char limit | Retry once; warn on long root paths |

---

## 6. Getting facts it doesn't have

A draft is only as good as the facts behind it. Every unknown falls into one of three
categories, and **which category it is decides whether the agent may ask at all.**

| | Example | What happens |
| --- | --- | --- |
| **A · already known** | Company name, country, device characteristics, MDR-vs-IVDR route | **Never ask — look it up.** The platform already holds these |
| **B · true, but unrecorded** | Device name and version, intended purpose, who holds which role, where documents live | **Ask once, reuse everywhere** |
| **C · not yet true** | Approval date, effective date, signature, test result, batch number | **Never ask. Leave the marker.** |

**Category C is the one that matters.** An agent that asks *"when was this approved?"* is
**more dangerous** than one that leaves a blank — the answer comes back looking sourced,
and a user trying to be helpful will invent a date. It is not an unknown fact; the document
simply has not been approved yet. The marker is the correct output, and the validator
already refuses a date in that field.

The volume makes the point. `[YYYY-MM-DD]` appears **246 times** across the corpus and
every one is category C — naive per-document questioning would ask 246 unanswerable
questions. Meanwhile `[Organisation]` appears **210 times** and is category A: one lookup,
210 slots filled, zero questions. And one category-B answer — the device name — fills 34
scope stubs.

### How the agent asks

**Once per activity, before drafting.** Not per document, and not as it goes:

1. Read `QMS-FACTS.yml` from the QMS folder
2. Take category-A facts from the brief — company name, country, device profile, route
3. Whatever is still missing **and is category B**, ask in **one batched round**, with
   selectable options wherever the answer space is known (device class, sterile yes/no,
   route, common role titles)
4. Everything category C becomes a marker — no question, ever
5. Write the answers back to `QMS-FACTS.yml`, so documents 2 through 275 never ask again

The batching is not politeness. A five-document activity asking a dozen times produces
question fatigue, and a fatigued user types anything to make it stop — which puts junk into
a quality record by a route the validator cannot see.

### Where the facts live

`QMS-FACTS.yml`, in the QMS folder next to `20_Drafts/`. On the customer's machine, like
everything else with content in it.

```yaml
# Facts reused across every document. Asked once, written here.
# NEVER put approval dates, signatures or results in this file — those belong to
# the moment they actually happen, not to a config file.
organisation: Acme Medical GmbH        # from the platform
country: Germany                       # from the platform
device:
  name: Acme Insulin Pump
  version: "2.0"
  intended_purpose: "…"
roles:                                 # ROLE TITLES, never a person's name
  management_representative: Head of Quality
  risk_manager: Head of Engineering
document_control:
  location: SharePoint › QMS
```

Roles are titles, never names — the same rule the header band enforces, and what makes a
document survive someone leaving.

### How the question reaches the user

Three mechanisms exist, and client support for the best one varies, so the design does not
depend on it:

| Mechanism | Fidelity | Availability |
| --- | --- | --- |
| **MCP elicitation** — server sends a schema, client renders a form with enums | Highest | Requires the client to advertise the capability. **Verify before relying on it** |
| The agent's own question affordance | High | Whatever the harness provides |
| **Structured question objects in a tool result**, relayed by the model | Adequate | Always |

**The contract is the structured question object; elicitation is an optimisation on top.**
The server always emits the same `FactRequest` payload (see BUILD.md §3.5). How it is
rendered is the client's business — so the feature degrades rather than breaking.

---

## 7. What the customer sees in the app

No new screens. Two surfaces gain a badge:

- **Activity page** — `Draft ready · 4 open questions` per document, and `3 of 5 documents drafted`
- **Document library page** — the same badge beside the template
- **Activity log** — every agent write, attributed to the member who owns the key, tagged *via agent*

Plus one action for members with write access: **Mark reviewed**. That is also the moment
they have what they need to close the activity.

---

## 8. The commercial model

| | Licence | **Agent add-on** |
| --- | --- | --- |
| Price | €1,800 / €6,000 | **monthly**, flat per workspace |
| Shape | one-time, perpetual | subscription |
| Buying | self-serve | self-serve |
| Requires | — | the licence first |

This is the model's **second genuinely recurring line** — and probably the better one.
`BUSINESS-MODEL.md` §1 names the structural weakness (*"no MRR floor — a slow month is a
zero month"*) and §4 calls the annual content-currency renewal *"the only recurring
layer"*. An add-on consumed **continuously** renews far more reliably than an update fee
remembered once a year.

**When it lapses:**

| | |
| --- | --- |
| Agent keys | inert immediately |
| Licence, documents, templates, downloads | unaffected |
| Local folder and every draft in it | untouched |
| **Draft records and badges in the app** | **still visible** |

That last row is deliberate. Those are the customer's own progress records. Hiding them
would repeat exactly the mistake `lib/billing/grant.ts` refuses to make for documents —
*"never revoke a regulated company's access to its own QMS documents."*

---

## 9. Decisions taken

| # | Decision | Why |
| --- | --- | --- |
| 1 | External MCP server, not in-app generation | No token cost, no liability for generated text, margin intact |
| 2 | HTML fragments matching the corpus | Round-trips into the app's own document view |
| 3 | One parameterised prompt, not 85 hand-written | Stays in sync when the corpus is regenerated |
| 4 | Forms and registers scaffolded, never filled | Filling one fabricates a quality record |
| 5 | Bring-your-own-LLM | Keeps us supplying a framework, not authoring conformity evidence |
| 6 | Platform stores metadata only | Keeps the promise `skills.md` already makes |
| 7 | Local folder, sync-agnostic, no cloud integration | A path is all that's needed |
| 8 | Agent opens work, human closes it | Protects the completion metric, and matches the docs |
| 9 | Monthly subscription, flat per workspace | The second recurring line; simplest to build and explain |
| 10 | Reusable facts in a local `QMS-FACTS.yml`, asked once per activity | Keeps content local; batching avoids the question fatigue that produces junk answers |
| 11 | The agent may ask for facts that exist, never for facts that don't yet | An invented date arriving via a question looks sourced — worse than a blank |

## 10. Risks

| Risk | Handling |
| --- | --- |
| **A weak model produces bad drafts and the customer blames us** | The validator. Bad output fails **loudly** rather than producing plausible-looking falsified records. This is why the validator is built before anything else |
| **Template leakage** | Bearer-authed endpoint, per-fetch audit row, revocation that actually works. Never bundled in a package |
| **Setup friction — three purchases, one of them a terminal** | The `init` / `doctor` commands, and stating the client requirement before checkout |
| **A false negative — a draft that validates but is wrong** | Measured deliberately in the evaluation slice. It is the metric that decides whether the claim is defensible |
| **Scope creep into "the agent runs your QMS"** | The four modes, and `handoff` in particular. Some things are a person's job |

## 11. Open questions

1. **The monthly price.** Deliberately not set here.
2. **The 12 `handoff` classifications** need a QARA review.
3. **Trial period?** A free first month interacts cleanly with the existing expiry column,
   but it is a go-to-market decision.
4. **Does the add-on need its own name?** It is currently "agent access" in the code and
   "agentic" in the schema. A product name would help the pricing page.
