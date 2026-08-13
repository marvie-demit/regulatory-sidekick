# Operations runbook

Things that live outside this repository. None of it is visible to code review,
and most of it fails **silently** when missed — so it is written down here.

## Migrations

Applied by hand in the Supabase SQL editor **before** deploying the matching app
code (the convention set by `0004_access_codes.sql:7-8`). Every migration is
idempotent and safe to re-run.

| # | What it adds |
|---|---|
| `0015_partners.sql` | partners, partner_members, partner_invitations, partner_audit; `access_codes.partner_id/batch_id/revoked_at`; allowance + mint/revoke/portfolio RPCs |
| `0016_partner_staff.sql` | `remove_partner_member`, `set_partner_member_role`; corrected `partner_revoke_code` |
| `0017_partner_branding.sql` | `partner_brand_by_slug`, public `brand` storage bucket |
| `0018_agent_document_scope.sql` | widens `agent_tokens_scopes_chk` to allow `read:documents` |

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
