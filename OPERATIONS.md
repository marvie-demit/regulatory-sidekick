# Operations runbook

Things that live outside this repository. None of it is visible to code review,
and most of it fails **silently** when missed — so it is written down here.

## Migrations

Applied by hand in the Supabase SQL editor **before** deploying the matching app
code (the convention set by `0004_access_codes.sql:7-8`). Every migration is
idempotent and safe to re-run.

| # | What it adds |
|---|---|
| `0014_billing.sql` | `purchases`, `stripe_events`, `organizations.stripe_customer_id` — applied 2026-08-18 |
| `0015_partners.sql` | partners, partner_members, partner_invitations, partner_audit; `access_codes.partner_id/batch_id/revoked_at`; allowance + mint/revoke/portfolio RPCs |
| `0016_partner_staff.sql` | `remove_partner_member`, `set_partner_member_role`; corrected `partner_revoke_code` |
| `0017_partner_branding.sql` | `partner_brand_by_slug`, public `brand` storage bucket |
| `0018_agent_document_scope.sql` | widens `agent_tokens_scopes_chk` to allow `read:documents` |
| `0019_document_drafts.sql` | `document_drafts` (metadata only, no content column); widens the scope CHECK again for `write:drafts` |
| `0020_agent_subscription.sql` | `purchases.kind`, nullable `plan`, `agent` tier, `monthly` cadence, `organizations.agentic_subscription_id`. **Requires `0014` first** — it alters `purchases` |
| `0021_draft_review_identity.sql` | tightens `dd_update` so a reviewer can only sign as themselves — **apply this**; without it a member can forge who reviewed a draft |
| `0022_startup_programme.sql` | `startup_applications` + RLS, `decide_startup_application()`, `partner_startup_applications()`, `purchases.startup_application_id`, widens the tier CHECK to allow `startup`. **Requires `0014` and `0015`** |
| `0023_agentic_access_codes.sql` | access codes can grant agent access: nullable `plan`, `agentic`/`agentic_days`, `partners.agentic_allowance`, `app.partner_agentic_seats_consumed()`, and rewritten `redeem_access_code` / `partner_mint_codes` / `partner_overview`. **Requires `0004`, `0013`, `0015`** |

### `0014` / `0020` — applied 2026-08-18

Both are live. Verified against the database: `purchases` and `stripe_events`
exist and are readable, `organizations.stripe_customer_id` and the 0020 columns
are present. The first real checkout ran the same day — `plan=full`,
`plan_expires_at` NULL, event claimed in `stripe_events`.

This section previously warned that `0014` had never been applied, and that a
customer completing checkout would be charged and get nothing. That is resolved;
the note is kept because the failure mode it describes is the one to re-check
after any future billing migration: **a webhook that cannot claim its event
returns 500 forever and the customer pays for nothing.**

## The Startup Programme

The €1,800 tier was renamed from Practitioner and is no longer self-serve. A
workspace applies at `/startup-programme`; a Platform Admin (or the Partner Admin
whose subdomain it was submitted through) approves; approval unlocks the existing
Stripe checkout for that workspace only.

**Approval does not grant access.** It opens the till. The customer still pays,
and `grantPurchasedAccess()` still runs from the webhook exactly as before — this
is a gate in front of checkout, not a second way to grant.

### Environment variables — RENAMED

| Was | Now |
|---|---|
| `STRIPE_PRICE_PRACTITIONER` | `STRIPE_PRICE_STARTUP` |
| `STRIPE_PRICE_PRACTITIONER_3X` | `STRIPE_PRICE_STARTUP_3X` |
| `STRIPE_PRICE_PRACTITIONER_6X` | `STRIPE_PRICE_STARTUP_6X` |

**Rename these in Vercel before deploying**, or the tier silently becomes
unbuyable: `offeredOptions()` sees no price and the card falls back to the
apply/contact route with no error anywhere.

### The solo-practitioner discount

Practitioner used to serve two audiences. Startups keep the €1,800 price behind
an application; solo QA/RA practitioners and consultants now get a **Stripe
promotion code** against Standard instead. `allow_promotion_codes: true` is set
on the Checkout Session, so the code box appears — create the coupons in the
Stripe dashboard (Products → Coupons → promotion code). Nothing in the app needs
to know they exist.

### The partner privacy boundary

`0015` deliberately limits a partner to "which workspace redeemed our code, and
when — nothing else, ever" (`partner_portfolio()`). `0022` adds a SECOND function,
`partner_startup_applications()`, which hands a partner an applicant's headcount,
funding position, revenue and their account of why CE marking is unaffordable.

That is a real widening and it was a deliberate decision. It is scoped in the
database to that partner's own applications, excludes drafts, and the form names
the partner before the applicant submits. **Do not merge the two functions** —
they are separate so a reviewer of any future change has to notice which one they
are touching.

## Agent access via codes (0023)

A code may now grant a licence, agent access, or both. Three things to know
before handing one out:

- **Agent seats are a SEPARATE partner allowance.** Set it per partner in the
  admin console ("Set agent seats"), independently of licences. One licence seat
  must never be able to carry a €150/month add-on nobody paid for, which is why
  there are two allowances, two counters and two checks rather than a weighting.
- **An agent-only code leaves the licence untouched** (`plan` is null). That is
  the trial mechanism: the customer who most wants an agent trial already holds
  a licence, and before 0023 every code overwrote the plan.
- **Redeeming never shortens an existing entitlement.** A 30-day code on a
  workspace whose subscription runs to December leaves December in place, and a
  workspace with indefinite access stays indefinite. `null` means *no access*
  when `agentic_enabled` is false and *indefinite* when it is true, so the merge
  is a CASE rather than a `greatest()` — read the comment in the migration before
  changing it.

The old 6-argument `partner_mint_codes` is **dropped** rather than left beside
the new 9-argument one: a caller reaching the old signature would mint with no
agentic allowance check at all.

Nothing here is sellable until `STRIPE_PRICE_AGENT_MONTHLY` exists — a code can
grant the add-on, but nobody can buy it.

## Releasing the desktop bundle

`npm run build -w @notjustany/regulatory-sidekick-mcp` produces
`packages/rsk-mcp/dist/regulatory-sidekick-<version>.mcpb`. Shipping it is three
manual steps, in this order:

1. Create a **private** Storage bucket named `releases` (once). It must not be
   public — `/api/agent/bundle` hands out a 60-second signed URL, and a public
   bucket would make the entitlement gate decorative.
2. Upload the `.mcpb` under its own filename, unchanged.
3. Flip `BUNDLE_AVAILABLE` in `lib/agent/release.ts` and set `CLIENT_LATEST` to
   the version you uploaded. Until then the Agent page says "coming" rather than
   linking to a download that 404s.

`CLIENT_MINIMUM` is the kill switch, not the update prompt. Raising it strands
every installed client below it, so move it only when a version is genuinely
unsafe to keep using — a validator bug that let a falsified record through, for
instance. `GET /api/v1/version` is unauthenticated on purpose: a client whose key
has lapsed still has to be able to hear "stop".

**`0019` must be applied before the deploy that ships it**, for the same reason
as `0018`: the *report drafts back* box adds a scope the CHECK would reject, and
key creation errors rather than degrading. The draft badges read through a
`try/catch`, so an unapplied `0019` shows "no drafts" rather than breaking the
activity and library pages — but the agent's `PUT …/draft` returns 503 until it
is applied.

**`0018` must be applied before the deploy that ships it.** Without it, creating
an agent key with the *fetch document templates* box ticked fails the CHECK
constraint and the whole key creation errors — the app cannot degrade around a
constraint violation. Keys minted before `0018` keep working, but 403 on the
template endpoint until they are re-issued; the Agent page says so per key.

The app degrades rather than crashing if one is missing (`listPartners` returns
empty, `listAccessCodes` steps down to a narrower select), but nothing works.

---

## Partner subdomains

Onboarding a partner is a **database row** — no redeploy, no DNS change. That is
the whole reason partners get `acme.<apex>` rather than their own domain. The
four steps below are one-time setup for the *mechanism*.

### 1. `NEXT_PUBLIC_APP_HOST`

Set to the apex partner subdomains hang off, e.g.
`regulatory-sidekick.notjustany.tech`. No scheme, no port. Read by
`lib/partners/host.ts` and `next.config.ts`. If unset both fall back to that
production host, so a missing variable degrades to "no partner subdomains"
rather than "every host is a partner".

### 2. Wildcard DNS

`*.<apex>` → the app. On Vercel, add the wildcard domain to the project.

### 3. Wildcard TLS — **start this first, it has the longest lead time**

A wildcard certificate for `*.<apex>`. On Vercel this generally requires the
zone's nameservers to be on Vercel, or a DNS-01 challenge. This is the single
most likely multi-day blocker in the whole feature; everything else is minutes.

### 4. Supabase → Auth → URL Configuration → Redirect URLs

Add `https://*.<apex>/**`. Leave Site URL on the apex.

**Without this, sign-up confirmation and password-reset links originating on a
partner subdomain fail silently** — `signUp` and `resetPasswordForEmail` send a
host-derived `redirectTo` (`lib/auth/actions.ts`), and Supabase rejects any
redirect not on the allow-list. There is no error in our logs; the user simply
never gets in. This is dashboard-only state with no artifact in the repo, which
is exactly why it is written here.

### Already handled in code

- `serverActions.allowedOrigins` in `next.config.ts` includes `*.<apex>`.
  Without it **every form on a partner subdomain 403s, including sign-in** —
  Next compares each Server Action's `Origin` against the host. Never widen this
  to a bare `"*"`; that disables the CSRF check outright.
- `proxy.ts` (renamed from the deprecated `middleware.ts`) parses the Host into a
  partner slug and injects `x-rs-partner-slug`, **deleting any inbound value
  first** so the header cannot be forged. It selects a colour scheme only —
  authorisation is always `partner_members` + RLS.
- Reserved slugs (`www`, `api`, `admin`, …) are rejected in three places that
  must stay in step: the `partners.slug` CHECK constraint (0015),
  `RESERVED_SLUGS` in `lib/partners/host.ts`, and the same set in
  `lib/admin/actions.ts`.

### Sessions are deliberately not shared across hosts

Supabase auth cookies are host-scoped with no explicit `domain`. A session on
`acme.<apex>` is separate from one on the apex or on `beta.<apex>`. That is the
isolation we want; the cost is that someone staffing two partners signs in
twice. Every generated link (invite, redeem, Stripe return, auth email) derives
from the request host via `lib/http/origin.ts`, so a flow started on a subdomain
stays there.

---

## Adding a partner

1. `/admin` → **Add a partner**: name, slug (this becomes the subdomain),
   type, licence allowance.
2. Expand **branding** on their row → four colours, wordmark, logo.
3. Expand **staff** → invite their first admin. From then on they invite their
   own colleagues from `/partner/team`.
4. Send them `https://<slug>.<apex>`.

**Suspending** a partner blocks minting *and* redemption of every outstanding
code, and their brand stops resolving. It is reversible. **Deleting** is refused
by an `ON DELETE RESTRICT` FK once any code exists — that FK is the policy, since
codes already in portfolio companies' hands must never be orphaned.

---

## Local development

`*.localhost` resolves without a hosts-file entry in Chrome and Firefox, so
`http://acme.localhost:3100` exercises the whole subdomain path. `allowedOrigins`
already covers `*.localhost:3100`.

Worth verifying there before shipping any change to this area:

- branding applies (colours, logo, tab title)
- **a form submits successfully** — that is the `allowedOrigins` check
- `curl -H 'x-rs-partner-slug: acme' http://localhost:3100/` changes nothing
- a partner staffer who is not a member of `acme` gets a 404 at
  `acme.localhost:3100/partner`, not someone else's console
