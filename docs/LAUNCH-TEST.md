# Launch test — the agent add-on, end to end

> One live purchase and one install on a clean machine. About an hour, and it
> costs Stripe's fee on a refunded sale. It proves the three things nothing has
> proven yet: the live Stripe config, buying the add-on, and the desktop bundle
> running on a machine that has never had Node.

Tick as you go. Every **Expect** is what the code does today, so anything else
is a finding. The SQL queries (A–E) are in the [appendix](#appendix--queries).

---

## 0. Before you start

- [ ] **A test workspace that holds a licence, with you as its admin.** The
      add-on refuses to sell without one ("Buy the licence first"). Grant it
      from the admin console or with a licence-only code. Not a customer's
      workspace.
- [ ] **A clean machine:** macOS or Windows, Claude Desktop not installed, and
      **no Node**. `node --version` in a terminal must fail. Windows 11 Home has
      no Windows Sandbox, so use a spare laptop or a cloud Windows VM.
- [ ] **The Supabase SQL editor open** with the appendix queries, and the test
      workspace's id in place of `<org>` (query A finds it).

## 1. Stripe and Vercel config

- [ ] **Vercel's "Needs Attention" badges** on `STRIPE_SECRET_KEY` and
      `STRIPE_WEBHOOK_SECRET`: click each, read what Vercel wants, fix it.
- [ ] **The key is live.** `STRIPE_SECRET_KEY` in Production starts `sk_live_`
      or `rk_live_`.
- [ ] **Every price ID is a live, active price** (Stripe → Product catalog, live
      mode). A test-mode ID under a live key fails as "No such price", and the
      customer sees only "Could not start checkout".

  | Variable | Expect |
  |---|---|
  | `STRIPE_PRICE_STANDARD` | €6,000, one-time |
  | `STRIPE_PRICE_STARTUP` | €1,800, one-time |
  | `STRIPE_PRICE_AGENT_MONTHLY` | €150, recurring monthly. The Agent page's "€150 / month" is copy only; Stripe charges what the price says |
  | `…_3X` / `…_6X`, if set | Standard €2,000 × 3 / €1,000 × 6, Startup €600 × 3 / €300 × 6, each recurring monthly. Unset ones are simply not offered |

- [ ] **Tax behaviour is "inclusive" on every price.** The pricing copy says
      prices include VAT.
- [ ] **Stripe Tax is set up** (Settings → Tax: origin address, registrations).
      Both checkouts run with `automatic_tax` on, and session creation fails
      without it.
- [ ] **The customer portal is configured in live mode** (Settings → Billing →
      Customer portal) and allows cancelling. "Manage subscription" on the
      Agent page opens it.
- [ ] **The live webhook endpoint:**
  - [ ] URL `https://regulatory-sidekick.notjustany.tech/api/stripe/webhook`
  - [ ] Events: `checkout.session.completed`, `checkout.session.expired`,
        `invoice.paid`, `invoice.payment_failed`,
        `customer.subscription.deleted`, `customer.tax_id.updated`
  - [ ] **API version `2025-03-31.basil` or later**, ideally
        `2026-06-24.dahlia`, which is what the SDK pins. The renewal handler
        reads `invoice.parent.subscription_details`, which older versions don't
        send: on an older endpoint the first month is granted and every renewal
        is silently ignored. Step 2 proves it either way.
  - [ ] Its signing secret is the `STRIPE_WEBHOOK_SECRET` in Vercel Production.
- [ ] **Redeploy production after changing any variable.** Vercel applies
      changed variables only to new deployments.

## 2. Buy the add-on (live)

In a normal browser, signed in as the test workspace's admin.

- [ ] **Agent page → "Subscribe to agent access".** Expect Stripe Checkout at
      €150 a month, with a VAT number field and a required billing address. Use
      a real card, and your company's real VAT number if you have one.
- [ ] **Pay.** Expect a return to `/agent?subscription=success`, with agent
      access shown as active.
- [ ] **Run queries A–D** a minute or two later:
  - [ ] A: `agentic_enabled` true; `agentic_expires_at` about one month plus
        36 hours away; `agentic_subscription_id` set; **`plan` unchanged**,
        because the add-on never grants a licence.
  - [ ] B: `kind` agent, `tier` agent, `plan` null, `status` active.
  - [ ] B: **`installments_paid` is 1.** That is the renewal path working. If
        it's empty while D shows an `invoice.paid`, the endpoint's API version
        is too old: create a new endpoint on the current version, put its
        signing secret in Vercel, redeploy, then delete the old endpoint.
  - [ ] C: `agentic.granted` twice, once from `stripe.checkout` and once from
        `stripe.invoice_paid`.
  - [ ] D: `checkout.session.completed` and `invoice.paid`. If you entered a
        VAT number, `customer.tax_id.updated` as well, which proves that event
        is switched on.
- [ ] **Stripe → Webhooks → the endpoint: every delivery returned 200.** A 500
      means the handler threw; Vercel's function logs show
      `[stripe] handling … failed` with the reason. Stripe retries on its own.
- [ ] **"Manage subscription" on the Agent page.** Expect the Stripe portal
      showing the subscription, and a link back to `/agent`.

## 3. Install on the clean machine

- [ ] **Confirm there is no Node:** `node --version` fails. This is the premise
      under test: Claude Desktop must run the extension on its own Node.
- [ ] **Install Claude Desktop** and sign in.
- [ ] **In a browser, sign in to the app as the test admin → Agent page →
      create a key** with every box ticked. Expect it active straight away (an
      admin's own key skips approval) and shown once, starting `rsk_`. Keep the
      tab open.
- [ ] **"Download the extension".** Expect `regulatory-sidekick-0.1.0.mcpb`,
      and `agent.bundle.download` in query C. A redirect to
      `/agent?bundle=unavailable` means the file is missing from the private
      `releases` bucket.
- [ ] **Double-click it.** Expect Claude Desktop's install dialog for
      Regulatory Sidekick, asking for **Workspace key**, **QMS folder**, and
      **Server (advanced)** prefilled with
      `https://regulatory-sidekick.notjustany.tech`. Paste the key, pick a new
      empty folder, leave the server alone.
- [ ] **Enable it. Expect it to start with no error.** **If it fails to start
      (`node` not found, `spawn node ENOENT`), stop here.** The bundle cannot
      ship without Node: set `BUNDLE_AVAILABLE` to `false` in
      `lib/agent/release.ts` and redeploy until it's fixed.
- [ ] Optional: the key is not in plain text anywhere in Claude's config folder
      (`%APPDATA%\Claude` on Windows, `~/Library/Application Support/Claude` on
      macOS). Search for its first few characters.

## 4. Use it once, end to end

In a new Claude Desktop chat. Allow each tool when Claude asks.

- [ ] **"Set up my QMS folder."** Expect `00_Controlled/`, `10_Records/`,
      `20_Drafts/` (with `_working/` inside), `OPEN-QUESTIONS.md`,
      `AGENT-LOG.md` and `QMS-FACTS.yml`. Run it first: on an empty folder the
      doctor reports the QMS folder as failing.
- [ ] **"Run the Regulatory Sidekick doctor."** Expect QMS folder, Facts file,
      Connection, Workspace (with the test workspace's name), Document
      templates, Draft reporting and Client version (`rsk-mcp/0.1.0`) all ok. A
      failing check says why in its detail.
- [ ] **"What should I work on next?"** Expect an activity that is open on the
      app's roadmap, not one already done.
- [ ] **"Draft the document for it."** Expect:
  - [ ] one new file in `20_Drafts/`, and nothing written anywhere else;
  - [ ] every unknown left as `[[NEEDS INPUT: …]]`, with matching entries in
        `OPEN-QUESTIONS.md`;
  - [ ] no invented dates, names, signatures or results;
  - [ ] in the app: a draft badge on that document in the Library and on the
        activity, and the activity In progress;
  - [ ] query E: one row with path and size. There is no content column, so
        the document itself never reached the platform.
- [ ] **Read the draft as a QARA reviewer would.** Once the open questions are
      answered, would you sign it? No code can make this check, and the product
      claim rests on it.
- [ ] **"Mark this activity as Done."** Expect a refusal (the API returns 403:
      closing an activity is a human act). It stays In progress.
- [ ] **Mark the draft reviewed in the app.** Expect `reviewed_by` to be you in
      query E.

## 5. Switch off, cancel, refund

- [ ] **Revoke the key on the Agent page.** Expect the next tool call in Claude
      Desktop to fail with an authorisation error.
- [ ] **Stripe → the subscription → Cancel immediately.** Expect:
  - [ ] D: `customer.subscription.deleted`;
  - [ ] B: `status` cancelled;
  - [ ] A: `agentic_subscription_id` empty and **`agentic_expires_at`
        unchanged**. By design, a cancelled subscription runs to the end of the
        period already paid for;
  - [ ] C: `agentic.subscription_cancelled`.
- [ ] **Refund the payment in Stripe.** Expect nothing to change in the app:
      there is no refund handler. Stripe keeps its processing fee.
- [ ] **Admin console → Organizations → the test workspace → agent access
      off**, because neither the cancel nor the refund does it. Expect the
      Agent page to show it off, and the draft badge from step 4 **still
      visible** in the Library: drafts outlive the add-on.
- [ ] Uninstall the extension from the clean machine.

---

## Not covered

- **A real renewal or a failed payment**, a month from now. `installments_paid`
  = 1 in step 2 proves the handler renewals go through; the rest is the date
  rule in `grantAgentAccess` (`lib/billing/grant.ts`).
- **The Claude Code route.** The npm package is unpublished
  (`MCP_AVAILABLE = false`), so there is nothing to install yet.
- **Partner subdomains.** See OPERATIONS.md.

## Appendix — queries

```sql
-- A. The workspace
select id, name, plan, agentic_enabled, agentic_expires_at, agentic_subscription_id
from organizations
where name = '<test workspace>';

-- B. Its agent purchase
select kind, tier, plan, status, mode, installments_paid, amount_total,
       stripe_subscription_id, created_at
from purchases
where org_id = '<org>' and kind = 'agent'
order by created_at desc
limit 1;

-- C. What happened, newest first
select created_at, action, detail
from audit_log
where org_id = '<org>'
order by created_at desc
limit 15;

-- D. What Stripe delivered
select received_at, type
from stripe_events
order by received_at desc
limit 15;

-- E. Drafts the agent reported
select doc_id, path, bytes, validated_at, reviewed_by, reviewed_at
from document_drafts
where org_id = '<org>';
```
