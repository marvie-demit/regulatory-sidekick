# Regulatory Sidekick — Business Model (MVP)

**Framing:** this is a *digital knowledge product* — codified regulatory know-how (a
sequenced implementation path, 275 controlled-document templates, a clause-level
traceability matrix) delivered through a web app. The app is the **delivery vehicle**,
not the product. Every decision below follows from that.

---

## 1. What "knowledge product, not SaaS" actually changes

| | SaaS | Knowledge product (this) |
|---|---|---|
| What's paid for | Ongoing utility of running software | A one-time transfer of expertise + a path to an outcome |
| Pricing logic | Per seat, per month | Value of the outcome vs. the alternative (consultant days) |
| Cost curve | Cost scales with usage | ~All cost is upfront authoring; marginal cost ≈ €0 |
| Gross margin | 70–85% | **90–95%** |
| Revenue shape | Compounding MRR | **Non-compounding.** Every euro must be re-sold next month |
| Retention risk | Churn | **Leakage** (files get shared) and **content decay** |
| Core metric | MRR / NRR | Deals per month, and completion rate of buyers |
| Growth constraint | Product capacity | **Distribution** |

**The single most important consequence:** with one-time pricing there is no MRR
floor. A slow month is a zero month. So the model needs *one* deliberately engineered
recurring layer — and in regulatory affairs there is a legitimate one (see §4).

---

## 2. Business Model Canvas

### Value proposition
> "A stepwise MDR/IVDR + ISO 13485 implementation, written by manufacturers who have
> been through it — so a two-person startup can get audit-ready without hiring a
> consultant for 60 days."

Three distinct jobs it does, in order of what people actually pay for:

1. **Sequencing** — *"what do I do first?"* This is the real scarcity. Templates are
   everywhere; a defensible order of operations is not. This is the moat.
2. **Artefacts** — 275 templates that are already interlinked and clause-mapped.
3. **Traceability** — the standards matrix + evidence trail is what you show an auditor.

### Customer segments

| Segment | Who | Willingness to pay | Urgency trigger |
|---|---|---|---|
| **A. Medtech / IVD startups** (pre-seed–Series A) | 2–15 people, first device, no QA/RA hire yet | €1,800 (cash-constrained, high pain) | Investor DD, first clinical study, CE mark deadline |
| **B. SME manufacturers** | 15–200 people, legacy MDD → MDR transition, or scaling a QMS | €6,000 (easy budget line) | Notified body audit date, MDR transition deadline |
| **C. Solo QA/RA consultants** | Deliver QMS builds to 3–10 clients/yr | €3,000–8,000/yr for a delivery licence | Every new client engagement |
| **D. Adjacent** | Accelerators, university spinout offices, contract manufacturers | Bulk / sponsored seats | Cohort intake |

Segment C is the highest-leverage and is currently a footnote on the pricing page. See §6.

### The alternative the buyer is really comparing against

| Option | Cost | Why they'd still choose you |
|---|---|---|
| Freelance RA consultant | €800–1,500/day × 40–80 days = **€35k–100k** | 10–30× cheaper; retained in-house |
| Off-the-shelf template pack | €1,500–5,000 | Templates without a path = shelfware |
| eQMS SaaS (Greenlight Guru, Qualio, Matrix) | €10k–40k **per year** | Those are *containers*; they don't tell you what to put in them |
| DIY from the standard text | "free" | 6–12 months of founder time |

> Verify these ranges for your market before they go in a deck. They're the right
> order of magnitude but they're my assumptions, not researched figures.

**Positioning statement:** *not* an eQMS. You are the **content layer** that eQMS
vendors deliberately don't sell. That framing also makes them partners, not competitors.

### Channels (ranked by leverage, not by ease)
1. **Consultants as a channel** — they carry the client relationship you'd spend €800 CAC to acquire.
2. **Practitioner-authored content** — LinkedIn/newsletter from a *named* RA person. In regulatory, trust is personal. An anonymous brand cannot sell this.
3. **Accelerator / incubator partnerships** — cohort deals (EIT Health-type programmes, medtech accelerators, university TTOs).
4. **Comparison + long-tail SEO** — "ISO 13485 implementation checklist", "MDR technical documentation template", "Greenlight Guru alternative".
5. **Notified-body waiting-room adjacency** — companies queuing for an audit are pre-qualified and time-poor.

### Key resources
The content corpus and its *currency*. Not the code. If the codebase burned down you'd
rebuild in 6 weeks; if the content corpus burned down you'd be out of business.

### Key activities
Content maintenance (regulatory watch) > sales > software. Budget your own time in that order.

### Cost structure
| Item | Year 1 |
|---|---|
| Hosting (Vercel + Supabase + storage) | €1,200 |
| Regulatory watch + content updates | Founder time (the real cost) |
| **Professional indemnity insurance** | €2,000–4,000 — **non-optional**, see §9 |
| Legal (licence terms, disclaimer review) | €2,000–3,000 |
| Payments (Stripe ~2.5% + VAT/OSS handling) | ~3% of revenue |
| Marketing | €0–10,000 depending on channel choice |

Marginal cost per additional customer: **< €20** (storage + ~2h support). This is the
whole reason the model works.

---

## 3. Revenue architecture — the ladder

The mistake to avoid is having exactly one price with a €6,000 step from free. Build rungs:

| Rung | Product | Price | Purpose |
|---|---|---|---|
| 0 | **Explore** (exists) — browse roadmap, matrix, library index, 1 sample activity | Free | Prove depth |
| 1 | **MDR/13485 readiness self-assessment** — scored PDF output | Free, email-gated | Lead capture + qualification signal |
| 2 | **"Stage-1 Ready" pack** — the 12 QSEs / core processes needed to survive a notified-body Stage 1 audit | **€690** | ⭐ The missing rung. Converts browsers into buyers, credit-back toward full access |
| 3 | **Practitioner** (exists) — full access, ≤3 users | €1,800 | Segment A |
| 4 | **Standard** (exists) — full access, teams | €6,000 | Segment B |
| 5 | **Currency subscription** (reframed) | 20–25% of purchase / yr | The only recurring layer |
| 6 | **Consultant / fund licence** (§6) | €3,000–15,000/yr | Segments C and D — highest leverage, and recurring |
| 7 | **Services attach** — gap review, 4× office-hours block | €1,500–4,000, or refer to a partner for 20% | Margin on demand you'll get anyway |

Rung 2 is the biggest single addition I'd make. Your content already has a natural
seam for it (`qses: 12` in `content/content.meta.json`), and it does three jobs at
once: it de-risks the €6k purchase, it produces revenue from people who will never buy
full access, and it gives you a price point that works in paid ads.

---

## 4. The recurring layer — make it honest

Regulatory content **decays**: MDCG guidance is revised, harmonised standards get new
editions, IVDR transition dates move. A QMS built on 2026 guidance is stale by 2028.
That is a *genuine* recurring need — which is what lets a knowledge product carry a
subscription without pretending to be SaaS.

**Fix the current pricing.** €2,000/yr renewal on top of a €1,800 Practitioner purchase
is more than the product itself. Nobody renews that. Peg it to purchase price:

| Tier | Purchase | Renewal (year 2+) | Target attach |
|---|---|---|---|
| Practitioner | €1,800 | **€390/yr** | 40% |
| Standard | €6,000 | **€1,200/yr** | 60% |
| Consultant | — | €3,000/yr (it *is* the subscription) | 85% |

Make renewal **opt-out, auto-charged**, and earn it with a visible artefact: a
quarterly "What changed in the regulation, and which of your documents it touches"
changelog, pushed into the app against the specific activities affected. If a buyer can
see that DOC-SOP-04 was revised because of a new MDCG document, the renewal defends
itself. If they can't see it, they cancel — correctly.

**Access after lapse:** they keep what they have (read + download), they stop getting
updates. Never revoke a regulated company's access to its own QMS documents — that
turns a churn event into a reputational one.

---

## 5. Unit economics

Blended assumptions, 70/30 Practitioner/Standard mix:

```
Blended ASP                          €3,060
COGS (support ~2h @ €80, hosting)      €180
Payment processing (~3%)                €92
─────────────────────────────────────────────
Gross profit                         €2,788   (91% margin)
```

Payback is **immediate** (one-time, paid upfront) — so unlike SaaS you can afford a
comparatively high CAC. At a €800 CAC you're still at 3.5:1 on first purchase alone,
before any renewal. This is the model's superpower: *you can buy customers profitably
from day one.* The constraint is finding a channel that converts at all.

### Three scenarios, year 1

| | Conservative | Base | Upside |
|---|---|---|---|
| Stage-1 packs (€690) | 20 · €13,800 | 60 · €41,400 | 150 · €103,500 |
| Practitioner (€1,800) | 12 · €21,600 | 30 · €54,000 | 60 · €108,000 |
| Standard (€6,000) | 4 · €24,000 | 12 · €72,000 | 28 · €168,000 |
| Consultant licences (§6.6) | 1 · €3,000 | 4 · €12,000 | 10 · €30,000 |
| Fund blocks (§6.4) | — | 1 · €12,000 | 3 · €45,000 |
| **Revenue** | **€62,400** | **€191,400** | **€454,500** |
| Deals/month (all rungs) | ~3 | ~9 | ~21 |

Fund blocks are absent from the conservative case on purpose — that motion can't start
until the §6.7 proof assets exist, so year 1 gets at most a partial contribution.

Year 2 adds renewals: base case ≈ €30–40k from maintenance, plus consultant and fund
licences renewing (those are recurring from day one, unlike the product itself). The
recurring layer only becomes meaningful in year 3 — plan cash accordingly.

**The number that matters:** base case is **9 transactions a month**, most of them
€690. That is a marketing problem, not a product problem. Which is the point of §8.

---

## 6. Institutional channels — funds and consultant practices

These are the two motions that sell once and reach many. Treat them as one strategic
move, because they have the same shape: **a multi-client licence that turns a one-time
product sale into an annual recurring line.** Together with content currency (§4), this
is how the model escapes its non-compounding-revenue problem.

### 6.1 Why medtech VCs beat accelerators

An accelerator gives you a lumpy cohort of ~15 pre-product companies twice a year. A
medtech fund has 20–40 active portfolio companies *continuously*, a platform budget, and
— decisively — its own capital exposed to regulatory delay.

| Motion | What it is | Yield |
|---|---|---|
| Perk listing | You appear on the portfolio perks page at 25% off | Low. These pages are graveyards unless paired with a real intro motion |
| **Sponsored licences** | The fund pre-buys a block for its portfolio | **The prize.** One €12–18k transaction instead of ten €1,800 sales |
| **Diligence instrument** | The fund runs your readiness assessment on companies pre-investment | Highest leverage; no competitor is doing it |

The sponsored motion solves the hardest problem in §2: Segment A is cash-constrained,
which is *why* Practitioner is €1,800. A fund deal **changes who the buyer is** — platform
budget instead of founder runway — and it renews structurally, because the portfolio
refreshes every year.

### 6.2 How to sell it — denominate everything in their unit of account

A fund does not buy tooling. It buys protection of its position. Three numbers, in order:

**1. It pays for itself on a third of one engagement.**
€15,000 across 12 companies is €1,250 per company. A QMS + technical-file build with a
freelance RA consultant runs 40–80 days at €800–1,500/day. Displace 30% of *one*
company's consultant spend, *once*, and the whole portfolio licence is covered. Most
checkable claim you have — lead with it and let them do the arithmetic.

**2. A four-month regulatory slip is a dilution event.**
A seed device company burning €150k/month with CE mark as the pre-Series-A inflection:
four months of avoidable delay is €600k of extra burn before the markup, which means a
bridge at seed valuation that the fund joins pro-rata to defend its position. The fund
writes an unplanned six-figure cheque. *(Illustrative archetype — substitute their real
portfolio profile on the call; the shape holds regardless of inputs.)*

**3. It defers a premature senior hire.**
Seed companies hire a VP RA at €120–160k fully loaded because nobody knows what comes
next. A sequenced plan lets a founder or junior QA person execute for 12–18 months.

**But the argument that actually lands is legibility, not cost.** Regulatory readiness is
the only major medtech risk with no dashboard — burn, hiring, pipeline and clinical
milestones are all instrumented, and then "how's the QMS going?" returns a paragraph. If
every portfolio company works the same four-phase plan, the fund can compare regulatory
maturity across the portfolio for the first time. Funds pay for legibility, and platform
teams are measured on exactly this.

This makes the **read-only investor view** of the phase dashboard a channel
prerequisite, not a nice-to-have. It is thin to build on what `/dashboard` already
computes, and it is the thing actually being sold; the licence is just the delivery
mechanism.

Pitch register: **portfolio insurance**, not software. A failed notified-body audit or
rejected technical file isn't a delay for a seed company — it can be terminal. Low
probability, high severity, cheap premium is a shape portfolio managers already price.

### 6.3 The cold email

> **Subject:** regulatory risk across [Fund]'s device portfolio
>
> Hi [Name] — I build the MDR/ISO 13485 implementation framework that [Portfolio Co]
> used to get from zero to audit-ready without a consultant retainer.
>
> One thing I keep seeing in early device teams: the regulatory pathway is the largest
> non-clinical risk to the next markup, and it's the only one with no dashboard. You can
> see burn, hiring and clinical progress. QMS readiness is a phone call.
>
> We licence this to funds as a portfolio block — every company works the same
> four-phase plan, and you get a read-only readiness view across all of them. It costs
> roughly a third of one consultant engagement.
>
> Worth 20 minutes? Happy to run our readiness assessment on a company you're
> diligencing right now so you can see the output before we talk commercials.

The last line is the hook: free, immediately useful, and it plants you at the moment of
investment. Buyer title to search is Head of Platform, Portfolio Operations or Operating
Partner; at smaller funds it collapses into a partner.

**Sourcing the list:** skip generic VC databases. Reverse-source from companies that
announced CE marking or MDR certification in the last 18 months and look at who funded
them — that yields funds with *proven* regulatory exposure rather than ones that merely
list "healthtech" as a sector.

### 6.4 Fund pricing ladder — never ask for €15k on the first call

Institutions don't buy that way. Climb:

| Stage | Offer | Price | Purpose |
|---|---|---|---|
| 1 | **Diligence run** — readiness assessment on 1–3 companies they're diligencing or just funded | Free | Proves output, no procurement, no endorsement needed |
| 2 | **3-company pilot** — full Practitioner access, day-0 and day-60 readiness scores | €3,600 (3 × €1,200) | Generates the data that sells stage 3 |
| 3 | **Drawdown block** — 10 licences redeemable over 24 months | €12,000 (€1,200 each, 33% off) | Procurement-easy: reads as a bulk discount, not a new subscription line |
| 4 | **Portfolio licence** — up to 12 active companies, aggregate readiness view, quarterly regulatory briefing to the partnership | €15,000/yr | The recurring line. Renews with portfolio refresh |

Land funds on the drawdown block, convert to the annual licence at renewal once you have
usage data. Stage 2 is what makes the renewal a data review rather than a pitch: *here's
where these three were, here's where they are, here's the consultant spend they didn't
incur.*

### 6.5 Objection handling

| Objection | Answer |
|---|---|
| "They can just hire a consultant." | They will, for the hard parts. This makes the consultant cheaper because they stop billing for setup, templates and sequencing and start billing for judgment. A rate-limiter, not a replacement — claiming displacement costs you credibility. |
| "We don't endorse vendors to our portfolio." | Then don't. Run the diligence motion (stage 1). No endorsement required, and it's arguably the better entry point. |
| "Isn't this just a template pack?" | Show the roadmap, never the library. Templates are commodity; sequencing is the product. Open with "275 documents" and you've lost. |
| "What if a portfolio company fails an audit using this?" | Their counsel *will* ask. Answer unhedged: it's a framework, not a certification; the manufacturer remains solely responsible; here's the licence language and the PI cover (§9). Any hedging kills the deal. |
| "No platform budget." | Ask for the portfolio introduction instead and sell direct at €1,800. Come back for the block next year. |

Keep the liability separation clean: you want "a resource our portfolio uses," never
"our fund-approved compliance vendor." The §9 disclaimer has to survive contact with a
fund's marketing team.

### 6.6 Consultant practice licence (Segment C)

Same structure, and currently only a footnote on the pricing page. Consultants carry the
client relationship you'd otherwise pay ~€800 CAC to acquire.

| Tier | Scope | Price |
|---|---|---|
| Solo | Deliver to own clients, ≤5 concurrent client workspaces | €3,000/yr |
| Practice | ≤20 concurrent workspaces, co-branded exports | €8,000/yr |
| Overage | Additional concurrent client workspace | €600 each |

Two terms that matter. First, the licence covers *delivery*, not resale — the consultant
may not sell templates standalone. Second, and more valuable: when an engagement ends,
the client's workspace converts to a direct Practitioner or Standard licence at 50%
credit. The channel becomes a funnel instead of a leak.

### 6.7 Hard prerequisite — do not run this motion yet

Both institutional motions need proof assets that don't exist today:

- 2–3 named reference customers, ideally inside a fund's portfolio
- The readiness assessment shipped (rung 1, §3)
- The read-only investor view shipped
- One case study with a real time-or-cost delta

Sell into one fund's portfolio company first, make them visibly successful, then walk in
the front door with their logo on the slide. Inbound-from-portfolio converts far better
than cold-to-fund, and fund cycles run 3–6 months — which is why this sequences to days
60–120 (§8), not day one. Medtech VC is a small enough world that a premature first
meeting costs you the second and third fund too.

---

## 7. Two pricing structure problems to fix now

**1. Practitioner vs Standard is judgment-gated, not structurally gated.** A 70%
discount decided "by application (proof of stage)" means you personally adjudicate
every deal, and larger companies will route through it. Replace the judgment with a
hard, self-declared, auditable line — e.g.:

> Practitioner: legal entity with **< €1M annual revenue** and **≤ 10 employees**, max
> 3 users, single device family. Self-declared at checkout; licence terms make a false
> declaration a breach payable at the difference.

Now it self-serves, scales, and you stop being a bottleneck.

**2. There is no checkout.** Both buttons are `mailto:`. That's the right call *today*
(see §8 phase 1) and the wrong call in 60 days — €690 impulse purchases die in an email
thread. Stripe Payment Links at rung 2, then full checkout at rungs 3–4.

---

## 8. How to approach this — the first 120 days

The instinct with a knowledge product is to finish the content first. Don't. The
content is already deep enough to sell; what's unvalidated is *whether anyone will pay
and whether buyers actually finish*.

### Days 1–30 — Sell it by hand, deliberately
Do **not** build checkout. Keep `mailto:` and sell 10 accounts personally at €1,800.

- Target: **10 paying design partners**, warm outreach only (your network, LinkedIn, medtech Slack/communities, accelerator intros).
- Every sale is a 30-minute call you run yourself. Record what they ask, what scares them, what they compare you to, and the exact sentence that makes them say yes.
- Free access is *not* validation. A €1,800 wire is. Discount to €900 as a "founding" price if needed — but charge.
- Give founding buyers a lifetime lock on updates. Cheap now, and they become your references.

**Kill/continue gate:** if you cannot close 10 from warm outreach, the problem is
positioning or trust, not price. Fix that before spending a euro on ads.

### Days 31–60 — Instrument completion, then productise the entry rung
The failure mode of every knowledge product is *buyers who never start*. A buyer who
never marks an activity done never renews, never refers, and quietly asks for a refund.

- Instrument: device profile set → first activity `Done` → 25% checklist at day 30. Report these to yourself weekly.
- Anything below ~40% activation gets fixed in-product before more selling (a guided first-week path, an email drip tied to phase 1, a live weekly onboarding call).
- Build **rung 2 (Stage-1 pack, €690)** and put it behind a Stripe Payment Link.
- Ship the **free readiness self-assessment** as the top of funnel.

### Days 61–90 — Open one channel properly, and land the first licences
- Pick **one**: consultant practices, or founder-led LinkedIn content. Not both. Run it for 8 weeks and measure.
- Write the consultant practice licence (§6.6) — multi-client workspaces, 50%-credit client conversion, renewal-based. Sign 3.
- Ship the first quarterly regulatory changelog — this is the renewal product, and it must exist before the first cohort hits month 12.
- Turn on self-serve checkout for Practitioner and Standard.
- Build the two fund prerequisites (§6.7): the read-only investor view and one case study with a real time-or-cost delta.

### Days 90–120 — Funds
Only now. Run the §6.2 pitch against a reverse-sourced list, starting with the fund that
already owns one of your happy customers. Ask for a free diligence run, not a licence.
Expect a 3–6 month cycle and don't let it displace direct selling.

### What to explicitly *not* build in the MVP
Per-seat billing, SSO, an API for customers, mobile, integrations, more content depth.
None of these are why someone doesn't buy.

---

## 9. Risks specific to this model

| Risk | Severity | Mitigation |
|---|---|---|
| **Regulatory liability** — you're supplying documents used for conformity | **High** | Explicit disclaimer on every template and in the licence: *starting point, not regulatory advice; no warranty of conformity; the manufacturer remains solely responsible*. Carry professional indemnity insurance from day one. Have a lawyer review before public launch — this is not a corner to cut. |
| **Leakage** — 275 downloadable files, one buyer shares them | High | Per-org watermarking + doc-code footer on download; licence terms; and structurally — sell the *path and the updates*, not the files. A regulated buyer needs their own auditable trail, which is exactly what they can't get from a shared zip. |
| **Content decay** | High | The renewal product (§4). Budget real founder time quarterly. |
| **No compounding revenue** | Structural | Rungs 2, 5, 6. Never let the model be "one price, sold once." |
| **Trust deficit** | High | Put a named, credentialed practitioner on the site with their track record. "By manufacturers, for manufacturers" needs a face to be worth anything. |
| **Refund exposure** | Medium | 14-day EU distance-selling right applies to consumers; for B2B set clear terms. Better defence: high activation. |
| **VAT/OSS on cross-border EU digital sales** | Medium | Reverse charge for B2B with a valid VAT ID; handle it in checkout from day one, not retroactively. |

---

## 10. Metrics — the right dashboard for a knowledge product

Stop looking for MRR/churn. Track:

**Commercial**
- Transactions/month, by rung
- Free → paid conversion (Explore → any paid)
- Rung 2 → rung 3/4 upgrade rate (target > 15%)
- CAC by channel, with immediate payback assumed

**Product (the leading indicators of everything else)**
- **Activation:** device profile set + ≥1 activity `Done` within 7 days (target > 60%)
- **Progression:** ≥25% checklist complete at day 30 (target > 40%)
- **Evidence uploads per org** — the strongest signal of real use
- Refund rate (target < 5%)

**Long-term**
- Maintenance renewal attach at month 12 (target 40% / 60% / 85% by tier)
- Referrals per buyer
- **Outcomes** — number of customers who passed an audit using it. One named case study is worth more than every other marketing asset combined.

---

## 11. Recommendation in one paragraph

Keep the one-time headline price — it matches how this buyer budgets (a capex project,
procurement-friendly, no "another subscription" objection) and it's your differentiator
against eQMS vendors. Add a €690 entry rung to stop the free→€6,000 cliff, replace the
judgment-based Practitioner gate with a structural one, and re-price the renewal to
20–25% of purchase with a visible quarterly regulatory changelog so it's actually
earned. Promote the institutional licences (§6) out of the footnote — consultant
practices and medtech funds are the only motions that both reach many buyers per sale
*and* renew annually, which is what fixes the non-compounding revenue problem the
one-time model otherwise has. Then spend the next 90 days selling ten accounts by hand
and measuring whether buyers *finish* — because in a knowledge product, completion is
retention, and distribution, not content, is the thing that will decide this.

---

### The depth claim — resolved
The corpus holds **116 activities / 338 sub-activities / 275 documents**, counted
directly from `content/content.json` and corroborated by the process model (39
processes, 116 steps — one step per activity).

Two summaries disagreed with it and neither was authoritative: the `stats` block
inside `content.json` (92 / 346) and `content/content.meta.json` (53 / 197). Both
are snapshots the external pipeline emits and both had gone stale across the
restructure commits — the marketing copy had been written off the first one.

The fix is structural, not a find-and-replace. Every customer-facing count now
renders from `counts()` in `lib/content/content.ts`, which derives the numbers
from the corpus on each build — landing page, pricing features, guide, and the
locked-content blurb. Nothing in the app reads `stats` or `content.meta.json` any
more, so the depth claim cannot drift from the content again.

**Still outstanding:** `content.meta.json` remains stale on disk (53 / 197). It is
generated output with a `contentHash` this repo can't recompute, so it should be
re-emitted by the pipeline rather than hand-edited. Harmless to the app — nothing
reads it — but it is a wrong number sitting in the repo.
