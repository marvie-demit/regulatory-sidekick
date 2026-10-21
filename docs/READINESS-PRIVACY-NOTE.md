# The privacy policy needs a paragraph before `/readiness` goes live

**Finding: yes, it needs one.** This file is a draft for you to accept, change or
reject. `app/privacy/page.tsx` is a real published policy under two legal
regimes, so nothing here has been applied to it.

## Why the existing text does not cover it

Every processing described in §2 today belongs to somebody who has an account:
account and credentials, workspace profile, usage and progress, uploaded
evidence, log data, payment data, the Startup Programme application, API tokens.
Each is justified under Art. 6(1)(b) GDPR as the performance of a contract or as
pre-contractual measures taken *at the request of the data subject* — a
reasonable reading, because in every case the person asked us for something.

The readiness assessment is different in three ways that matter:

1. **The respondent has no account and may never have one.** They are not a
   customer, a workspace member or an applicant. There is no contract to perform
   and, for most of them, none in prospect.
2. **A new category of data is collected from a new category of person**: an
   email address, an optional company name and role, and a candid self-report of
   how unready their quality system is. The last part is commercially sensitive
   — it is roughly what a diligence note would say — and nothing in §2 describes
   collecting anything like it from a non-customer.
3. **There is an optional marketing consent on the form.** §3 lists four legal
   bases and Art. 6(1)(a) is not among them, because until now the app never
   asked for consent to anything. The gate's changelog checkbox is exactly that,
   and `readiness_leads.marketing_consent` / `consent_text` store it.

There is also a retention question §6 has no answer for. §6 ties every period to
"the duration of the contractual relationship" or to workspace deletion. A lead
is neither: nobody deletes a workspace that never existed, so without a stated
period these rows would be kept indefinitely by default, which is the one
retention answer that is hard to defend.

Note what does **not** need changing. §4 (cookies) is still accurate — the
assessment sets no cookie and runs no analytics. §5 (recipients and processors)
is still accurate: the data stays in the existing Supabase project and Vercel
deployment, and the public result page passes nothing to anyone new.

## Draft text

Three insertions, in both language bodies. The German is the binding version, so
it is the one to read carefully; the English follows it.

### 1. In §2, as a new `<h3>` — suggested position: after *Zahlungsdaten* /
*Payment data* and before *Bewerbung zum Startup-Programm* / *Startup Programme
application*

German:

```jsx
    <h3>Kostenlose Reifegrad-Selbsteinschätzung</h3>
    <p>
      Die Selbsteinschätzung unter <code>/readiness</code> steht ohne Konto zur
      Verfügung. Um das Ergebnis anzuzeigen und den dauerhaften Ergebnislink
      bereitzustellen, verarbeiten wir Ihre E-Mail-Adresse, auf Wunsch
      Unternehmensname und Ihre Rolle, Ihre Antworten im Fragebogen (Regulierung,
      Risikoklasse, Produktmerkmale, Projektfortschritt, Stand der Benannten
      Stelle, Zeitdruck) sowie den daraus berechneten Punktwert.
      Rechtsgrundlage ist Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;b DSGVO
      (vorvertragliche Maßnahme auf Ihre Anfrage hin): ohne diese Angaben kann
      das angeforderte Ergebnis nicht erstellt und nicht erneut aufgerufen
      werden.
    </p>
    <p>
      Das Ergebnis ist unter einer nicht erratbaren Adresse abrufbar, damit Sie
      es weitergeben können. Wer den Link kennt, sieht den Punktwert, die
      Auswertung und den von Ihnen angegebenen Unternehmensnamen —{" "}
      <strong>nicht Ihre E-Mail-Adresse</strong> und nicht, ob Sie dem
      E-Mail-Versand zugestimmt haben. Geben Sie den Link nur weiter, soweit Sie
      das wünschen.
    </p>
    <p>
      Haben Sie im Formular zusätzlich dem Versand des vierteljährlichen
      Regulierungs-Changelogs zugestimmt, verarbeiten wir Ihre E-Mail-Adresse zu
      diesem Zweck auf Grundlage Ihrer Einwilligung (Art.&nbsp;6 Abs.&nbsp;1
      lit.&nbsp;a DSGVO). Die Einwilligung ist freiwillig, für das Ergebnis nicht
      erforderlich und jederzeit widerrufbar; der Wortlaut, dem Sie zugestimmt
      haben, wird zum Nachweis mitgespeichert. Ohne diese Zustimmung erhalten Sie
      von uns keine weiteren E-Mails.
    </p>
```

English:

```jsx
    <h3>Free readiness self-assessment</h3>
    <p>
      The self-assessment at <code>/readiness</code> is available without an
      account. To show you the result and to keep the permanent result link
      working, we process your email address, optionally your company name and
      role, your answers to the questionnaire (regulation, risk class, device
      characteristics, project progress, notified-body status, timeline
      pressure) and the score computed from them. The legal basis is
      Art.&nbsp;6(1)(b) GDPR, a pre-contractual measure taken at your request:
      without this we cannot produce the result you asked for or let you open it
      again.
    </p>
    <p>
      The result is reachable at an unguessable address so that you can forward
      it. Anyone holding the link sees the score, the breakdown and the company
      name you entered — <strong>not your email address</strong>, and not whether
      you agreed to be emailed. Share the link only as far as you intend to.
    </p>
    <p>
      If you also ticked the box for the quarterly regulatory changelog, we
      process your email address for that purpose on the basis of your consent
      (Art.&nbsp;6(1)(a) GDPR). It is optional, it is not needed for the result,
      and you may withdraw it at any time; the wording you agreed to is stored
      alongside it as evidence. Without that consent we send you no further
      email.
    </p>
```

### 2. In §3, as a new list item

German — after the *Transaktionale E-Mails* bullet:

```jsx
      <li>
        <strong>Reifegrad-Selbsteinschätzung</strong>: Erstellung und
        Bereitstellung des angeforderten Ergebnisses: Art. 6 Abs. 1 lit. b DSGVO.
        Versand des Regulierungs-Changelogs ausschließlich bei ausdrücklicher
        Zustimmung: Art. 6 Abs. 1 lit. a DSGVO.
      </li>
```

English:

```jsx
      <li>
        <strong>Readiness self-assessment</strong>: producing and serving the
        result you asked for: Art. 6(1)(b) GDPR. Sending the regulatory
        changelog, only where expressly agreed: Art. 6(1)(a) GDPR.
      </li>
```

### 3. In §6, as a new retention item

The period is the open decision — these two sentences pick **24 months**, which
is long enough for the day-0 / day-60 comparison the business model relies on
(§6.4, stage 2) and for a sales cycle, and short enough to defend. Change the
number if you would rather it were 12.

German:

```jsx
      <li>
        <strong>Reifegrad-Selbsteinschätzungen</strong>: E-Mail-Adresse,
        Antworten und Ergebnis werden 24&nbsp;Monate ab Erstellung gespeichert,
        danach gelöscht; der Ergebnislink ist ab der Löschung nicht mehr
        abrufbar. Wird daraus ein Vertragsverhältnis, gilt die Frist für
        Vertragsdaten. Eine Einwilligung zum Changelog-Versand gilt bis zum
        Widerruf; nach einem Widerruf bleibt allein deren Nachweis erhalten.
      </li>
```

English:

```jsx
      <li>
        <strong>Readiness self-assessments</strong>: the email address, the
        answers and the result are kept for 24&nbsp;months from completion and
        then deleted; the result link stops working at that point. Where a
        contractual relationship follows, the retention period for contract data
        applies instead. A consent to the changelog lasts until withdrawn; after
        a withdrawal only the record of the consent is kept.
      </li>
```

## What else is implied by publishing the above

Three things the text promises that are not built yet. Either build them or
soften the wording before this goes live:

- **The 24-month deletion is not automated.** Nothing deletes `readiness_leads`
  rows today. It needs a scheduled job or a line in the operations runbook that
  someone actually runs.
- **There is no unsubscribe mechanism**, because there is no email delivery at
  all yet (see OPERATIONS.md). The moment a changelog is sent, "jederzeit
  widerrufbar" needs a working link behind it.
- **An erasure request has no self-service path.** It is a `delete from
  public.readiness_leads where lower(email) = …` in the SQL editor, which is fine
  for the volumes rung 1 will see at first, and worth writing into the runbook
  rather than remembering.

---

## Addendum — what migration 0025 changes in the above

`0025` closed the two gaps `0024` shipped with (rate limiting and an unverified
address). Both touch this draft, so read these before accepting the text above.

### The consent paragraph gets easier to defend, not harder

The §3 item above asks you to publish Art. 6(1)(a) as a legal basis for the
changelog. That claim is now true in a way it was not before: `marketing_consent`
can only be set by `readiness_confirm_consent()`, reached by opening a link sent
to the address itself, so a consent record in the table is evidence that someone
holding that mailbox acted. Before `0025` it was evidence that somebody typed an
address into a public form, which is not the same thing and is exactly what Art.
7(1) asks you to be able to demonstrate.

Two consequences for the wording:

- **A sentence saying the subscription takes effect only after confirmation is
  worth adding**, because it is now a factual description of the mechanism and it
  is the kind of detail a supervisory authority reads as diligence.
- **The "until withdrawn" retention line still needs an unsubscribe**, and the
  bullet above about that is unchanged. `consent_state` has a `withdrawn` value
  reserved for it; nothing writes it yet.

### A new processing to disclose: the rate-limit bucket

`readiness_attempts` stores **sha256(server-side salt + ip address)** with a
retention of four one-hour windows, pruned by the function on each write. The
raw address is never stored and never leaves the request.

Whether this needs its own line in §2 is a judgement call, and the honest answer
is that it probably does. A salted hash of an IP is still personal data in the
GDPR sense — pseudonymised, not anonymised, because the salt exists. It is a
different processing from everything else in §2 (security of processing, Art.
6(1)(f), not contract performance), and the balancing test is easy to pass: the
purpose is preventing abuse of a public form, the data is a hash, the retention
is hours, and the alternative was an open write endpoint. Suggested wording for
both language bodies, to sit after the readiness item:

> **Missbrauchsschutz:** Beim Absenden des Readiness-Fragebogens speichern wir
> einen mit einem geheimen Schlüssel gebildeten Hash Ihrer IP-Adresse für
> wenige Stunden, um Massenübermittlungen zu unterbinden. Die IP-Adresse selbst
> wird nicht gespeichert. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO
> (Sicherheit der Verarbeitung).

> **Abuse prevention:** When the readiness questionnaire is submitted we store a
> keyed hash of your IP address for a few hours in order to prevent bulk
> submissions. The address itself is not stored. The legal basis is Art. 6(1)(f)
> GDPR (security of processing).

If you would rather not add a line to the policy at all, the alternative is to
drop the rate limiter and accept that the lead list can be filled with
fabricated rows. That is a worse trade: the list is the asset BUSINESS-MODEL.md
§6.7 sells to a fund, and a policy sentence about a short-lived hash is cheaper
than a list nobody can trust.

### The §6 retention item needs one more clause

The 24-month line above covers the lead. Add the bucket, which is on a different
clock and genuinely automatic — unlike the 24 months, which still is not:

> Hashes aus dem Missbrauchsschutz werden nach wenigen Stunden automatisch
> gelöscht.

> Abuse-prevention hashes are deleted automatically after a few hours.
