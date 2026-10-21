# Europe — market scope and outreach drafts

> §1 and §2 are the scope: what the corpus can claim, and which countries it can
> be sold into. §3 onwards is Germany and Switzerland specifically — four email
> drafts and a one-page partner offer, not sent mail. Every figure is traceable
> to `BUSINESS-MODEL.md` or to a check recorded below; every `[bracket]` is
> yours to fill. Read §1 first — it changes the order the two countries should
> be worked in.

---

## 1. What the corpus can and cannot claim

Counted directly from `content/content.json` on 2026-10-21, because the pitch has
to match what the product actually contains (`BUSINESS-MODEL.md` §9, regulatory
liability — an over-claim here is the expensive kind of mistake):

| Searched | Hits | What it means for the pitch |
|---|---|---|
| `DiGA` | 25 | **Covered properly.** A DiGAV/BfArM requirements activity, a *DiGA Requirements Checklist* document, and the right framing: *"DiGA is on top of CE marking, not instead of it"* |
| `BfArM` | 10 | Covered as the DiGA authority |
| `FDA` | 102 | US route covered |
| `EU Authorised Representative` | yes — a *Mandate* document, plus PRRC | **This is the Swiss artefact.** See below |
| `Switzerland` / `Swissmedic` / `MedDO` / `MepV` / `CH-REP` | **0** | The Swiss *domestic* route is not in the corpus at all |
| `MPDG` | 0 | German implementing act unnamed; minor, MDR carries the weight |
| `UKCA` | 1 | Effectively uncovered — do not pitch the UK |

### Therefore: Germany first, Switzerland second

That reverses the order in the request, for two reasons.

**Germany is a product fit today, and has a wedge nobody else has.** DiGA
applicants are software companies that must hold a CE-marked Class I or IIa
device before BfArM will list them for reimbursement. They have no QA/RA
function, no sense of the sequence, and a revenue model that stays blocked until
the QMS exists. A generic MDR template pack has no DiGAV layer; the corpus does.
That is the sharpest *"what do I do first?"* buyer in either country.

**Switzerland is sellable, but only as the EU route — say so plainly.** Checked
2026-10-21: Swiss manufacturers are still third-country manufacturers under EU
MDR. The EU–Switzerland package signed 2 March 2026 is not yet in force and sits
in parliamentary review, so a Swiss manufacturer placing a device on the EU
market needs an Article 11 EU authorised representative, an EU importer and
EU notified-body certification regardless of how ratification goes. The corpus
covers exactly that path, and holds the *EU Authorised Representative Mandate*
it turns on. What it does not cover is Swissmedic registration under MedDO, or
the CH-REP an EU manufacturer needs coming the other way.

So the Swiss sentence is: *"the EU route a Swiss manufacturer has to take, EU-REP
mandate included — not your Swissmedic filing."* Honest, still valuable, and the
ratification limbo is itself the urgency trigger. Closing that gap is perhaps one
activity and two or three documents; worth doing before approaching Swiss Medtech
as an institution, and not worth waiting for before talking to Swiss startups
selling into the EU.

---

## 2. Which countries you can offer this in

**All 27 member states, plus Norway, Iceland and Liechtenstein.** That is
structural rather than optimistic: `profileToScope()` in
`lib/content/process-scope.ts:71` builds the market set as `new Set(["EU"])` and
only ever adds `"US-FDA"`. There is no per-member-state concept anywhere in the
product, which is correct — MDR and IVDR are Regulations with direct effect, so
the sequence, the templates, the clause mapping and EUDAMED registration are
identical in Dublin and in Sofia. Nothing in the product has to change to sell
into any of them.

What does not travel is the German layer. `PECAN` (France's early-access route
for digital medical devices), `mHealthBELGIUM`, `HTA` and `health technology
assessment` all return **zero hits** in `content/content.json`. So the DiGA
argument in §5 works in Germany and nowhere else — do not reuse that email in
Paris or Brussels, because it will not survive the first question.

### The three constraints that actually decide where to sell

**1. Sales language, not product language.** MDR permits technical documentation
and the QMS in English, notified bodies work in English, and the corpus handles
the national-language obligation correctly as a per-market *process* rather than
27 hard-coded rules (*"Confirm eIFU eligibility and required member-state
translations"*). The product is therefore sellable everywhere as it stands. The
real filter is whether the buyer reads a cold email in English.

**2. Tax-inclusive pricing makes the margin depend on the buyer's paperwork.**
An Austrian sole trader (ATU78302114), tax-inclusive prices, and
`lib/billing/actions.ts:137-141` sets `automatic_tax`, `tax_id_collection` and a
required billing address with **no `allowed_countries` restriction** — checkout
already works EU-wide. B2B with a valid VAT ID reverse-charges and the full
€6,000 is kept. Without a valid number the local VAT comes out of that €6,000
rather than being added to it, which is exactly the exposure the
`billing.vat_id_rejected` audit entries exist to catch. So: B2B only, always
collect the VAT number, and query that audit log at filing time as
`OPERATIONS.md` says.

**3. The entity form scales with the country count.** A sole trader is
personally liable, and this supplies documents used for conformity assessment —
every member state sold into is another forum. Staying strictly B2B matters
legally as well as commercially, because consumer jurisdiction rules would let a
private buyer sue at home whatever the licence says. Before selling into 27
countries, confirm the professional indemnity cover that `BUSINESS-MODEL.md` §9
calls non-optional is scoped to the EEA and not only to Austria.

### Priority order

| Tier | Countries | Why |
|---|---|---|
| 1 | **Germany** | Largest European medtech market, SME-dense, and the only one where the corpus has a layer competitors lack |
| 2 | **Netherlands, Denmark, Sweden, Ireland** | English-native business culture, high medtech density, and €6,000 reads as cheap against local consultant rates. Best effort-to-return tier after Germany, with no new content and no translation |
| 3 | **Austria** | Small, but it is the home jurisdiction: domestic VAT, same language, and people can be met in person |
| 4 | **Belgium, Finland** | Same shape as tier 2, smaller |
| 5 | **France, Italy, Spain** | Large and real, but expect to sell in the local language, and France will ask about PECAN |
| 6 | **CEE (Poland, Czechia and neighbours)** | Growing, but €6,000 against local consultant rates is a harder sit — the €1,800 Startup Programme is the realistic entry |

Outside the EU/EEA: Switzerland as the EU route only (§1). Northern Ireland
follows MDR under the Windsor Framework if it ever comes up. The UK proper is
out — `UKCA` has a single mention in the entire corpus.

---

## 3. Targets, ranked

| # | Target | Country | Why it is here | Verified? |
|---|---|---|---|---|
| 1 | **DiGA applicants, direct** | DE | Findable, urgent, underserved, and the one place the corpus has a layer competitors lack | Corpus checked; build the list from BfArM's DiGA directory |
| 2 | **MedicalMountains AG**, Tuttlingen | DE | Cluster management for a region that is >90% SMEs, and MDR burden reduction is its main regulatory activity — it has filed position papers with the Bundestag and the health ministry | Yes |
| 3 | **Solo RA consultants / small practices** | DE + CH | §6.6, the highest-leverage channel; Germany has the densest RA consultant market in Europe | Model, not search |
| 4 | **Swiss Medtech** | CH | The national association; its members carry the compound third-country problem above | Association verified; approach after the MedDO gap is closed |
| 5 | BVMed, SPECTARIS | DE | National associations, but membership skews to large manufacturers — later, and lower yield | Named as industry data sources only; their services not verified |
| 6 | Medical Valley EMN (Erlangen), BioM (Munich), BioRegio STERN (Stuttgart), Life Science Nord (Hamburg); Basel Area / DayOne, sitem-insel (Bern), Venturelab | DE / CH | Plausible cluster and accelerator conduits | **Not verified — check each before use** |

Row 6 is a list of leads, not a list of facts. I did not confirm their current
programmes, intake windows or contacts.

**The "free readiness review" promised in §6 and §8 is a manual act today.** The
scored self-assessment (`BUSINESS-MODEL.md` §3, rung 1) is being built and is not
live, so for now this is you, a call and the roadmap — which is how §6.4 stage 1
is meant to work anyway. Do not describe it as a tool until it is one.

**On free access, which is where this started.** Keep it a trade, not a
giveaway: a dated code against a named deliverable. A cluster or association
gets a partner row — branded subdomain, a licence allowance, codes they
distribute, `partner_portfolio()` holding the privacy line, `revoked_at` and
partner suspension as the undo. A consultant gets 90 days against a critical
read and, if it survives, a named quote. A DiGA founder gets nothing free: they
get the paid Startup Programme, because they have a funded, reimbursement-blocked
revenue model, and §8's rule applies — a wire is validation, free access is not.

---

## 4. Email — MedicalMountains AG (German)

A partner conversation: they distribute, you keep the audit trail. Their own
public position is that MDR effort is disproportionate for small manufacturers,
which is the argument you are answering — so lead there, not with features.

> **Betreff:** MDR-Aufwand bei kleinen Herstellern — ein sequenzierter Umsetzungspfad
>
> Sehr geehrte Damen und Herren,
>
> MedicalMountains vertritt seit Jahren die Position, dass der MDR-Aufwand für
> kleine Hersteller in keinem Verhältnis zum Sicherheitsgewinn steht. Ich
> arbeite an dem Teil des Problems, der sich ohne Gesetzesänderung lösen lässt:
> an der Reihenfolge.
>
> Wir haben einen vollständigen MDR/IVDR- und ISO-13485-Umsetzungspfad
> codifiziert — 116 Aktivitäten, 275 mitgeltende Dokumentvorlagen, klausel-
> genau auf die Normen abgebildet. Vorlagen gibt es überall; was fehlt, ist eine
> belastbare Reihenfolge: womit fange ich an, was hängt wovon ab, was muss zur
> Stage-1-Prüfung fertig sein. Genau daran scheitern kleine Teams, nicht an der
> Textarbeit.
>
> Für Cluster richten wir das als Partnerzugang ein: eigene Subdomain in Ihrem
> Branding, ein Kontingent an Zugangscodes, die Sie an Ihre Mitglieder ausgeben,
> und ein Überblick darüber, welches Mitgliedsunternehmen eingelöst hat — mehr
> sehen wir Ihnen gegenüber nicht, und Sie sehen keine Inhalte Ihrer Mitglieder.
>
> Hätten Sie 20 Minuten? Ich würde den Pfad gern an einem Ihrer Mitglieder
> durchgehen, das gerade vor einer Stage-1-Prüfung steht — kostenfrei und
> unabhängig davon, ob daraus etwas wird.
>
> Mit freundlichen Grüßen
> [Name], [Qualifikation / Jahre in der RA-Praxis]
> [Telefon] · [E-Mail]

**Before sending:** the counts are filled from the corpus (see §8) — re-check
them if content has shipped since, because a wrong number in a first email to a
cluster is unrecoverable. Say nothing about renewal pricing; see §8.

---

## 5. Email — DiGA applicant, direct to the founder (German)

The highest-conversion motion of the four, and the one that needs no
institution. Source the list from BfArM's DiGA directory — both the listed apps
(their competitors, which is itself the hook) and any company that has publicly
announced it is applying.

> **Betreff:** DiGA-Antrag — der CE-Teil, in der richtigen Reihenfolge
>
> Hallo [Name],
>
> [Firma] geht auf die DiGA-Listung zu. Dann kennen Sie die Stelle, an der es
> klemmt: das BfArM prüft den DiGAV-Katalog, aber die CE-Kennzeichnung nach MDR
> muss vorher stehen — DiGA kommt auf die CE-Konformität obendrauf, nicht an
> ihre Stelle. Für ein Software-Team ohne QM-Abteilung ist das der Punkt, an dem
> Monate verloren gehen.
>
> Wir haben diesen Weg vollständig durchsequenziert: ISO 13485 und MDR von Null
> bis Audit-Reife, mit den DiGAV-Anforderungen als eigener Ebene darüber —
> Datenschutz, Sicherheit, Interoperabilität, Usability und der Nachweis des
> positiven Versorgungseffekts, jeweils gegen die Evidenz gemappt, die Sie
> ohnehin erzeugen müssen. Alle mitgeltenden Vorlagen sind enthalten und
> untereinander verknüpft.
>
> Für Startups, die CE noch nicht aus eigener Kraft finanzieren können, gibt es
> einen eigenen Tarif; der Antrag dauert fünf Minuten. Gegenüber einem
> Beratungsmandat über 40 bis 80 Tage ist das ein Bruchteil.
>
> Soll ich Ihnen zeigen, wo [Firma] auf dem Pfad gerade steht? 20 Minuten, keine
> Verkaufspräsentation.
>
> [Name]
> [Telefon] · [E-Mail]

**Do not offer this one free.** A DiGA applicant has a funded, reimbursement-
blocked business model: they are the buyer, not the design partner.

---

## 6. Email — Swiss Medtech (English)

Send this once the MedDO gap in §1 is closed, or send it with the limitation
stated — but never let a national association discover the gap by itself.

> **Subject:** the EU route for Swiss manufacturers — a sequenced implementation path
>
> Dear [Name],
>
> Your members have a problem EU manufacturers do not. With the MRA still lapsed
> and the March 2026 package not yet in force, a Swiss manufacturer placing a
> device on the EU market is a third-country manufacturer — Article 11
> authorised representative, EU importer, EU notified body — and has to prepare
> for that regardless of how ratification goes.
>
> We have codified that route: a sequenced MDR/IVDR and ISO 13485
> implementation, 116 activities and 275 controlled-document templates mapped to
> the clauses, including the EU Authorised Representative Mandate that the
> third-country position turns on. It was written by manufacturers who have been
> through it, so what we sell is the order of operations rather than the templates.
>
> To be straight about the boundary: we cover the EU route, not the Swiss
> domestic one. Swissmedic registration under MedDO is not in the corpus today.
>
> For an association we set this up as a partner licence — your branding, a block
> of access codes for members, and an overview of which member organisations
> redeemed, with no visibility into their content.
>
> Worth 20 minutes? I would rather first run our readiness review on one member
> company that is mid-transition, free, so you see the output before we discuss
> anything commercial.
>
> Kind regards,
> [Name], [credential]

---

## 7. Email — solo RA consultant / small practice (German)

This is the free-access motion proper, and §6.6's channel. Three to five people,
by name, found through LinkedIn or the regulatory-affairs sessions at the
German-language medtech conferences.

> **Betreff:** Bitte um eine fachliche Zerlegung — 90 Tage Vollzugriff
>
> Hallo [Name],
>
> ich suche keine Kundin und keinen Kunden, sondern eine fachliche Zerlegung.
>
> Wir haben einen MDR/IVDR- und ISO-13485-Umsetzungspfad aufgebaut: 116
> Aktivitäten, 275 mitgeltende Vorlagen, klauselgenaue Rückverfolgbarkeit. Die
> Vorlagen sind der leichte Teil. Das Produkt ist die Reihenfolge — und ob die
> trägt, können nur Leute beurteilen, die diesen Aufbau mehrfach geliefert haben.
>
> Konkret: 90 Tage voller Zugriff, kostenfrei und ohne Kaufverpflichtung. Ich
> möchte dafür eine ehrliche Antwort auf eine Frage — wo ist die Reihenfolge
> falsch? Wenn sie trägt, würde ich Sie um ein namentliches Zitat bitten; wenn
> nicht, ist mir die Kritik mehr wert.
>
> Für Beratungspraxen gibt es darüber hinaus eine Lizenz, die die Auslieferung
> an eigene Mandanten abdeckt — darüber können wir sprechen, wenn sich das Erste
> für Sie gelohnt hat.
>
> [Name]
> [Telefon] · [E-Mail]

Mint the code dated, one named recipient per code, and keep the batch so it can
be revoked. 275 downloadable documents in a consultant's hands is
`BUSINESS-MODEL.md` §9's leakage row — the dated code and the per-org document
footer are the mitigation, and the trade is worth the residual risk. A code
against a specific named deliverable is defensible; an open-ended free tier is not.

---

## 8. One-page partner offer

For a cluster or association. Keep it to one page, and send it as a PDF rather
than pasting it into the thread.

---

### Regulatory Sidekick — partner access for clusters and associations

**What it is.** A sequenced MDR/IVDR and ISO 13485 implementation path: 116
activities, 338 deep sub-activities and 275 controlled-document templates, mapped
clause by clause to the standards, with the traceability matrix and evidence
trail an auditor asks for. Written by manufacturers who have been through it.

**What it is not.** Not an eQMS. An eQMS is a container; this is the content
layer that tells a small team what to put in it, and in what order. Not
regulatory advice, and not a certification — the manufacturer remains solely
responsible. The licence says so, and so does every template.

**The problem it addresses for your members.** For a small manufacturer the MDR
obstacle is not the document text, it is the sequence: what comes first, what
depends on what, and what has to be finished before a notified-body Stage 1
review. Template packs do not answer that. A freelance RA consultant does, at
40–80 days and €800–1,500 a day.

**How partner access works.**

| | |
|---|---|
| **Your own subdomain** | `[yourname].regulatory-sidekick.notjustany.tech`, in your colours, with your wordmark and logo |
| **An allowance of access codes** | You mint and distribute them to members; each code gives one member organisation its own private workspace |
| **A member overview** | Which member organisation redeemed a code, and when |
| **Your own staff** | You invite your colleagues; they manage the allowance without us |
| **Revocable** | Any code can be withdrawn, and the whole allowance suspended, by you or by us |

**The privacy boundary, stated as a commitment.** You see which member
organisation redeemed a code, and when. You never see their documents, their
evidence, their progress or their device. That is enforced in our database
rather than promised in a policy: a partner's view is a single function with no
access to member content.

**What we would like first.** Not a procurement decision. One introduction to a
member company mid-transition, and a free readiness review of where it stands.
You see the output before anything commercial is discussed.

**Commercials.** Partner allowances are negotiated, not listed. Direct pricing
for members, for reference: Standard €6,000 one-time, and a Startup Programme at
€1,800 by application for companies that cannot yet fund CE marking. One-time,
VAT included, instalments available. Twelve months of updates and support are
included; continuing them afterwards is optional and priced as a fraction of the
purchase.

**[Name], [credential]** · [email] · [phone]
*Regulatory Sidekick — [legal entity], see the Impressum*

---

### Two things to fix before this one-pager goes out

1. **The renewal figure.** The pricing page still reads *"an optional €2,000 /
   year keeps them coming"* against an €1,800 tier. `BUSINESS-MODEL.md` §4 prices
   it at €390 and €1,200. Until the page is fixed, the one-pager says "a fraction
   of the purchase" and nothing more — and anyone you send to the pricing page
   will read the contradiction for themselves.
2. **The counts.** 116 activities / 338 sub-activities / 275 documents,
   computed from `content/content.json` on 2026-10-21 with the same derivation
   as `counts()` in `lib/content/content.ts`. Never take them from
   `content.meta.json`, which is stale on disk (53 / 197) and documented as such
   at the end of `BUSINESS-MODEL.md`. Re-derive before a second send.
