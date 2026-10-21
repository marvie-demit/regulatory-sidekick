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
| `0015_partners.sql` | partners, partner_members, partner_invitations, partner_audit; `access_codes.partner_id/batch_id/revoked_at`; allowance + mint/revoke/portfolio RPCs — applied, verified 2026-10-21 |
| `0016_partner_staff.sql` | `remove_partner_member`, `set_partner_member_role`; corrected `partner_revoke_code` — applied, verified 2026-10-21 |
| `0017_partner_branding.sql` | `partner_brand_by_slug`, public `brand` storage bucket — applied, verified 2026-10-21 |
| `0018_agent_document_scope.sql` | widens `agent_tokens_scopes_chk` to allow `read:documents` — applied, verified 2026-10-21 |
| `0019_document_drafts.sql` | `document_drafts` (metadata only, no content column); widens the scope CHECK again for `write:drafts` — applied, verified 2026-10-21 |
| `0020_agent_subscription.sql` | `purchases.kind`, nullable `plan`, `agent` tier, `monthly` cadence, `organizations.agentic_subscription_id`. **Requires `0014` first** — it alters `purchases`. Applied 2026-08-18, re-verified 2026-10-21 |
| `0021_draft_review_identity.sql` | tightens `dd_update` so a reviewer can only sign as themselves — applied, verified 2026-10-21 |
| `0022_startup_programme.sql` | `startup_applications` + RLS, `decide_startup_application()`, `partner_startup_applications()`, `purchases.startup_application_id`, widens the tier CHECK to allow `startup`. **Requires `0014` and `0015`** — applied, verified 2026-10-21 |
| `0023_agentic_access_codes.sql` | access codes can grant agent access: nullable `plan`, `agentic`/`agentic_days`, `partners.agentic_allowance`, `app.partner_agentic_seats_consumed()`, and rewritten `redeem_access_code` / `partner_mint_codes` / `partner_overview`. **Requires `0004`, `0013`, `0015`** — applied, verified 2026-10-21 |
| `0024_readiness_leads.sql` | `readiness_leads` (the free readiness assessment's lead capture) with RLS **on and no policies**, plus `readiness_result_by_token()` for the public result page. **Requires `0015`** for the `partner_id` reference. ⚠️ **NOT YET APPLIED** — see below |
| `0025_readiness_abuse_and_consent.sql` | `readiness_attempts` (hashed-ip rate-limit bucket, RLS on and no policies) + `readiness_rate_take()`; and double opt-in on `readiness_leads` — `consent_state`/`consent_token`/`consent_requested_at`/`consent_confirmed_at` plus `readiness_confirm_consent()`, which is now the only thing that can set `marketing_consent` true. **Requires `0024`**. ⚠️ **NOT YET APPLIED** — see below |

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

### `0015`–`0023` — verified 2026-10-21

All live. Checked against the live PostgREST schema: every table, column and
RPC these migrations add is present, including the 9-argument
`partner_mint_codes` and a nullable `access_codes.plan` from `0023`.

The schema does not expose CHECK constraints, policies or storage buckets, so
the rest is inferred: every file runs between `begin;` and `commit;`, and if its
visible objects exist the whole file ran. That covers the `brand` bucket
(`0017`) and the `startup` tier (`0022`). `0018` adds nothing visible; it is
covered because `0019` rewrites the same constraint to a superset.

`0021` replaces one RLS policy and nothing else, so it was checked directly in
the SQL editor. Re-check it after any restore — without it a member can sign a
draft review in a colleague's name:

```sql
select with_check from pg_policies
where schemaname = 'public' and tablename = 'document_drafts'
  and policyname = 'dd_update';  -- must mention auth.uid()
```

### `0024` — NOT YET APPLIED

Written, not run. **Apply it in the SQL editor before the deploy that ships
`/readiness`**, per the convention at the top of this section. Until it is
applied the assessment still works and still scores — `saveLead()` returns
`stored: false` and the respondent sees their result — but nothing is captured
and the permanent `/readiness/r/<token>` link 404s. That is the whole point of
the rung, so this is not a migration to leave pending.

Two things to know before applying it, both deliberate:

**The table has RLS enabled and no policies at all.** Not an oversight. It means
`anon` and `authenticated` can do nothing with `readiness_leads`, and the only
reader is the service role — which is what "platform admin" means here
(`lib/auth/platform.ts`: an env allowlist, never a database role). A lead list is
other people's email addresses next to their own account of how unready they are;
no customer workspace has any business reading it. If a future migration adds a
policy to this table, that is the thing to question.

**The public result page does not hold the service role.** It calls
`readiness_result_by_token()`, a security-definer function that takes an
unguessable token and returns the score, the name on it and nothing else — no
email, no consent flag, no answers. So the blast radius of a guessed or leaked
token is one company's readiness score rather than the lead list.

Verify after applying:

```sql
-- the table exists, RLS is on, and there are no policies on it
select relrowsecurity from pg_class where oid = 'public.readiness_leads'::regclass;
select count(*) from pg_policies
where schemaname = 'public' and tablename = 'readiness_leads';  -- must be 0

-- the public read works and leaks nothing: this must error on l.email
select email from public.readiness_result_by_token('x');
```

There is no admin UI for the leads yet (see below). Read them in the SQL editor:

```sql
select created_at, email, org_name, overall, band, route, risk_class
from public.readiness_leads order by created_at desc limit 50;
```

### `0025` — NOT YET APPLIED

Written, not run. **Apply it after `0024` and before the deploy that ships
`/readiness`.** It closes the two things `0024` left open on a public,
unauthenticated route whose server action holds the service role.

**Nothing limited the write.** The only brake was a 120-second dedupe on the
same address, so a script varying the local part could fill the table. `0025`
adds `readiness_attempts` and `readiness_rate_take()`: ten submissions an hour
per client address, counted and recorded in one function so two simultaneous
requests cannot both squeeze past the check.

The bucket stores **sha256(salt + ip)**, never an address. The salt is
`READINESS_IP_SALT` if set, otherwise `SUPABASE_SERVICE_ROLE_KEY` — so the
limiter starts working the moment this migration is applied instead of waiting
for a second variable nobody remembers. Set the dedicated one if you would
rather not reuse the key; rotating it just empties every bucket. Rows older than
four windows are pruned by the function itself, so there is no cron to forget.

**The limiter fails OPEN in every degraded case** — no address header, no salt,
no service role, migration unapplied, database unreachable. That is deliberate
(`lib/readiness/ratelimit.ts`): it protects the quality of a lead list, not
access to anything, so a fault in it must never stop a founder who answered
twenty questions from seeing their score. If you want to know whether it is
actually running, check that rows are arriving:

```sql
select count(*), max(created_at) from public.readiness_attempts;
```

**The address was never verified.** `marketing_consent` used to be set straight
from a tick box on a form anyone can submit with anyone's address, which is not
something Art. 7(1) GDPR lets you demonstrate as consent. Now the form can only
*ask*: the row is written `consent_state = 'pending'` with a `consent_token`,
and **only `readiness_confirm_consent()` can set `marketing_consent` true**,
reached by opening `/readiness/confirm/<token>`. The migration also demotes any
pre-existing `marketing_consent = true` row to `pending`, which in practice
updates nothing because `0024` has never been applied.

**The confirmation email is the one piece still missing.** There is no
transactional mailer in this project, so nothing sends that link today and the
confirmed list stays empty — which is the correct state for a list that cannot
yet prove its addresses. Wiring a provider is what makes the changelog sendable;
until then `/readiness/confirm/<token>` works if you paste a token into it by
hand, which is also how to test it.

Verify after applying:

```sql
-- the bucket exists, RLS on, no policies
select relrowsecurity from pg_class where oid = 'public.readiness_attempts'::regclass;
select count(*) from pg_policies
where schemaname = 'public' and tablename = 'readiness_attempts';  -- must be 0

-- the limiter answers, and twice in a row with max 1 must give true then false
select public.readiness_rate_take(repeat('a', 64), 1, 3600);
select public.readiness_rate_take(repeat('a', 64), 1, 3600);
delete from public.readiness_attempts where ip_hash = repeat('a', 64);

-- consent columns and the CHECK are in place
select consent_state from public.readiness_leads limit 1;  -- column exists
select public.readiness_confirm_consent('x');              -- false, not an error
```

## The readiness assessment has no admin view yet

`/readiness` captures leads into `readiness_leads` and there is **no page in the
admin console that lists them**. Deliberate, not forgotten: the table ships
unapplied, so a tab would have had nothing to query, and the console's own tabs
are a separate piece of work. Until it exists the lead list lives in the SQL
editor (query above), and `marketing_consent` is the column to filter on before
sending anyone the quarterly changelog. Since `0025` that flag means **confirmed
by the address owner** and nothing else can set it, so it is safe to treat as the
mailing list:

```sql
select email, org_name, consent_confirmed_at from public.readiness_leads
where marketing_consent is true order by consent_confirmed_at desc;
```

`consent_state = 'pending'` is the queue of people who asked and have not
confirmed. Do not send to that queue; it is what the confirmation email is for.

There is also **no email delivery**. The gate says "show my result", never "we'll
email it", because this app has no transactional email provider — only Supabase's
own auth mail. The permanent link is what the respondent keeps. If a provider is
ever wired up, the copy on the gate is what has to change first; promising an
email that never arrives would be worse than not offering one.

The missing mailer is now also what keeps the changelog list empty: `0025` makes
confirmation the only route to `marketing_consent = true`, and nothing sends the
confirmation link. That is the right failure direction — an empty list rather
than one you cannot defend — but it does mean **wiring a provider is a
prerequisite for the §4 renewal product**, not a nicety, since the quarterly
changelog is what the renewal is sold on.

## VAT verification arrives after the sale

**Enable `customer.tax_id.updated` on the live webhook destination.** It is not
on by default, and without it the handler below never runs. Nothing breaks
visibly; you simply stop hearing about VAT numbers that turned out to be fake.

Stripe zero-rates a reverse-charge sale on the **format** of the VAT number the
buyer types, then asks VIES whether it exists. That answer comes back minutes or
days later, long after the money moved. If VIES rejects it, the sale was never
eligible for reverse charge and the VAT is yours to pay. Prices are
tax-inclusive, so it comes out of what you received rather than being added to
it: a rejected number on an EUR 1,800 sale is a real loss, not an invoice you
can send.

`onTaxIdUpdated` in the webhook writes one of two audit entries against the
workspace, each listing the sales it covers and what was received:

| Action | Means |
|---|---|
| `billing.vat_id_rejected` | VIES said the number does not exist. Assume you owe the VAT on the listed sales |
| `billing.vat_id_unchecked` | VIES was unreachable. No liability established, but no evidence of a check either. It may resolve on its own |

`pending` and `verified` are deliberately not recorded. Stripe keeps the
evidence of a successful check on the tax ID itself, and logging the happy path
would bury the two statuses that need a person.

**The handler never revokes access and never computes the amount owed.** Access
stays for the same reason a failed instalment does not revoke it. The amount is
left out because which rate applies once reverse charge fails depends on place
of supply and on whether OSS is in play, which is the accountant's call and not
a constant belonging in a webhook. Query the audit log at filing time:

```sql
select created_at, org_id, detail
from audit_log
where action in ('billing.vat_id_rejected', 'billing.vat_id_unchecked')
order by created_at desc;
```

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

**Done in Vercel.** `STRIPE_PRICE_STARTUP` is set for Production and Preview
(updated 2026-08-26) and no `PRACTITIONER` name remains. The `_3X`/`_6X`
variants were not checked; an unset one is simply not offered.

Keep the failure mode in mind for any future rename: a missing variable makes
the tier silently unbuyable. `offeredOptions()` sees no price and the card
falls back to the apply/contact route with no error anywhere.

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

`STRIPE_PRICE_AGENT_MONTHLY` is set in Vercel for Production since 2026-09-08,
so the add-on can be bought as well as granted by a code. It is not set for
Preview, so preview deployments do not offer it. The variable is confirmed; the
price behind it has not been checked against Stripe.

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
