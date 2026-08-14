import { LegalDoc } from "@/components/legal/LegalDoc";

export const metadata = {
  title: "Impressum / Legal notice",
  description: "Offenlegung gemäß § 5 ECG und § 25 MedienG.",
};

// Operator details taken from the existing group Impressum at
// md.notjustany.tech. This is an AUSTRIAN sole trader, so the governing rules
// are § 5 ECG (E-Commerce-Gesetz) and § 25 MedienG — not the German § 5 DDG /
// § 18 MStV that a generic template would reach for.
const DE = (
  <>
    <h2>Angaben gemäß § 5 ECG und § 25 MedienG</h2>
    <dl>
      <dt>Medieninhaber und Diensteanbieter</dt>
      <dd>
        Marvie Demit
        <br />
        Einzelunternehmen (nicht im Firmenbuch eingetragen)
      </dd>
      <dt>Anschrift</dt>
      <dd>
        Gerasdorfer Straße 61/4/2
        <br />
        1210 Wien
        <br />
        Österreich
      </dd>
      <dt>E-Mail</dt>
      <dd>
        <a href="mailto:marvie.demit@notjustany.tech">
          marvie.demit@notjustany.tech
        </a>
      </dd>
      <dt>Telefon</dt>
      <dd>
        <a href="tel:+4367763488114">+43 677 634 881 14</a>
      </dd>
      <dt>Umsatzsteuer-Identifikationsnummer</dt>
      <dd>ATU78302114</dd>
    </dl>

    <h2>Gewerberechtliche Angaben</h2>
    <dl>
      <dt>Kammerzugehörigkeit</dt>
      <dd>Mitglied der Wirtschaftskammer Wien (WKO)</dd>
      <dt>Anwendbare Rechtsvorschrift</dt>
      <dd>
        Gewerbeordnung (GewO), abrufbar unter{" "}
        <a
          href="https://www.ris.bka.gv.at"
          target="_blank"
          rel="noopener noreferrer"
        >
          www.ris.bka.gv.at
        </a>
      </dd>
      <dt>Aufsichts- bzw. Gewerbebehörde</dt>
      <dd>Magistrat der Stadt Wien</dd>
    </dl>

    <h2>Grundlegende Richtung gemäß § 25 MedienG</h2>
    <p>
      Regulatory Sidekick ist ein informations- und anwendungsorientiertes
      Angebot zur schrittweisen Einführung eines Qualitätsmanagementsystems nach
      ISO&nbsp;13485 sowie zur Umsetzung der Anforderungen der EU-Verordnungen
      über Medizinprodukte (MDR) und In-vitro-Diagnostika (IVDR). Die Inhalte
      richten sich an Hersteller und deren Mitarbeiterinnen und Mitarbeiter und
      dienen der praktischen Unterstützung bei der Einführung und Pflege eines
      solchen Systems.
    </p>
    <p>
      Die bereitgestellten Inhalte, Vorlagen und Checklisten stellen keine
      Rechts-, Zulassungs- oder Zertifizierungsberatung dar und ersetzen weder
      die Bewertung durch eine benannte Stelle noch die eigenverantwortliche
      Prüfung durch den Hersteller.
    </p>

    <h2>Verbraucherstreitbeilegung</h2>
    <p>
      Marvie Demit ist nicht verpflichtet und nicht bereit, an einem
      Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle
      teilzunehmen.
    </p>
    <p>
      Die Online-Streitbeilegungsplattform (OS-Plattform) der Europäischen
      Kommission wurde mit 20.&nbsp;Juli&nbsp;2025 eingestellt; ein Verweis
      darauf entfällt daher.
    </p>

    <h2>Haftung für Inhalte</h2>
    <p>
      Die Inhalte dieser Website wurden mit größtmöglicher Sorgfalt erstellt.
      Für die Richtigkeit, Vollständigkeit und Aktualität der Inhalte kann
      jedoch keine Gewähr übernommen werden. Als Diensteanbieter sind wir gemäß
      § 18 Abs.&nbsp;1 ECG für eigene Inhalte nach den allgemeinen Gesetzen
      verantwortlich; nach den §§&nbsp;13 bis 17 ECG besteht jedoch keine
      allgemeine Verpflichtung, gespeicherte oder übermittelte fremde
      Informationen zu überwachen oder aktiv nach Umständen zu forschen, die auf
      eine rechtswidrige Tätigkeit hinweisen. Bei Bekanntwerden konkreter
      Rechtsverletzungen werden die betroffenen Inhalte umgehend entfernt.
    </p>

    <h2>Haftung für Links</h2>
    <p>
      Dieses Angebot enthält Verweise auf externe Websites Dritter, auf deren
      Inhalte kein Einfluss besteht. Für diese fremden Inhalte kann daher keine
      Gewähr übernommen werden; verantwortlich ist stets der jeweilige Anbieter
      oder Betreiber der verlinkten Seiten. Zum Zeitpunkt der Verlinkung waren
      keine rechtswidrigen Inhalte erkennbar. Bei Bekanntwerden von
      Rechtsverletzungen werden entsprechende Links umgehend entfernt.
    </p>

    <h2>Urheberrecht</h2>
    <p>
      Die auf dieser Website veröffentlichten Inhalte, Vorlagen und Werke
      unterliegen dem österreichischen Urheberrecht. Vervielfältigung,
      Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der Grenzen
      des Urheberrechts bedürfen der schriftlichen Zustimmung des jeweiligen
      Urhebers.
    </p>

    <h2>Nutzungsrechte an den Vorlagen</h2>
    <p>
      Mit einem aufrechten Nutzungsverhältnis wird dem berechtigten
      Arbeitsbereich ein einfaches, nicht ausschließliches, nicht übertragbares
      und nicht unterlizenzierbares Recht eingeräumt, die bereitgestellten
      Vorlagen, Checklisten und Textbausteine innerhalb des eigenen
      Unternehmens zu vervielfältigen, zu bearbeiten und für das eigene
      Qualitätsmanagementsystem zu verwenden.
    </p>
    <p>
      Die daraus erstellten Dokumente gehören dem jeweiligen Unternehmen. Das
      Recht, sie weiter zu verwenden, aufzubewahren und einer benannten Stelle
      oder Behörde vorzulegen, besteht auch nach Ende des Nutzungsverhältnisses
      unbefristet fort — ein Qualitätsmanagementsystem wäre andernfalls nicht
      nachweisbar. Mit Ende des Nutzungsverhältnisses entfällt lediglich der
      Zugang zu neuen und aktualisierten Vorlagen.
    </p>
    <p>
      Nicht umfasst sind die Weitergabe, der Weiterverkauf, die öffentliche
      Zugänglichmachung und jede sonstige Überlassung der Vorlagen in im
      Wesentlichen unveränderter Form an Dritte sowie ihre Verwendung zum Aufbau
      eines konkurrierenden Angebots. Beratungsunternehmen dürfen die Vorlagen
      in Mandaten einsetzen, sofern für jedes betreute Unternehmen ein eigenes
      Nutzungsverhältnis besteht.
    </p>
    <p>
      Soweit gesondert vereinbarte Nutzungsbedingungen bestehen, gehen diese den
      vorstehenden Bestimmungen vor.
    </p>

    <h2>Datenschutz</h2>
    <p>
      Informationen zur Verarbeitung personenbezogener Daten finden Sie in der{" "}
      <a href="/privacy">Datenschutzerklärung</a>.
    </p>
  </>
);

const EN = (
  <>
    <h2>Information pursuant to § 5 ECG and § 25 MedienG</h2>
    <p>
      Regulatory Sidekick is operated from Austria. The disclosure requirements
      below follow the Austrian E-Commerce Act (ECG) and Media Act (MedienG).
    </p>
    <dl>
      <dt>Media owner and service provider</dt>
      <dd>
        Marvie Demit
        <br />
        Sole trader (not entered in the Austrian company register)
      </dd>
      <dt>Address</dt>
      <dd>
        Gerasdorfer Strasse 61/4/2
        <br />
        1210 Vienna
        <br />
        Austria
      </dd>
      <dt>Email</dt>
      <dd>
        <a href="mailto:marvie.demit@notjustany.tech">
          marvie.demit@notjustany.tech
        </a>
      </dd>
      <dt>Telephone</dt>
      <dd>
        <a href="tel:+4367763488114">+43 677 634 881 14</a>
      </dd>
      <dt>VAT identification number</dt>
      <dd>ATU78302114</dd>
    </dl>

    <h2>Trade regulation details</h2>
    <dl>
      <dt>Chamber membership</dt>
      <dd>Member of the Austrian Economic Chamber, Vienna (WKO)</dd>
      <dt>Applicable regulation</dt>
      <dd>
        Austrian Trade Act (Gewerbeordnung, GewO), available at{" "}
        <a
          href="https://www.ris.bka.gv.at"
          target="_blank"
          rel="noopener noreferrer"
        >
          www.ris.bka.gv.at
        </a>
      </dd>
      <dt>Supervisory / trade authority</dt>
      <dd>Municipal Authority of the City of Vienna (Magistrat der Stadt Wien)</dd>
    </dl>

    <h2>Editorial focus pursuant to § 25 MedienG</h2>
    <p>
      Regulatory Sidekick is an information- and practice-oriented offering for
      the stepwise introduction of a quality management system under
      ISO&nbsp;13485 and for implementing the requirements of the EU Medical
      Device Regulation (MDR) and In Vitro Diagnostic Regulation (IVDR). It is
      addressed to manufacturers and their staff, and serves as practical
      support in establishing and maintaining such a system.
    </p>
    <p>
      The content, templates and checklists provided do not constitute legal,
      regulatory or certification advice. They replace neither assessment by a
      notified body nor the manufacturer&rsquo;s own responsibility to verify.
    </p>

    <h2>Consumer dispute resolution</h2>
    <p>
      Marvie Demit is neither obliged nor willing to participate in dispute
      resolution proceedings before a consumer arbitration board.
    </p>
    <p>
      The European Commission&rsquo;s Online Dispute Resolution platform was
      discontinued on 20 July 2025, so no reference to it is given.
    </p>

    <h2>Liability for content</h2>
    <p>
      The content of this website has been prepared with the greatest possible
      care. No warranty can be given, however, as to its accuracy, completeness
      or currency. As a service provider we are responsible for our own content
      under general law pursuant to § 18 (1) ECG; under §§ 13 to 17 ECG there is
      no general obligation to monitor stored or transmitted third-party
      information, or to actively investigate circumstances indicating unlawful
      activity. Where specific infringements become known, the content concerned
      will be removed promptly.
    </p>

    <h2>Liability for links</h2>
    <p>
      This offering contains references to external third-party websites over
      whose content we have no influence. No warranty can therefore be given for
      that third-party content; responsibility rests with the respective
      provider or operator of the linked pages. At the time of linking, no
      unlawful content was apparent. Where infringements become known, the links
      concerned will be removed promptly.
    </p>

    <h2>Copyright</h2>
    <p>
      The content, templates and works published on this website are subject to
      Austrian copyright law. Reproduction, adaptation, distribution and any form
      of exploitation beyond the limits of copyright require the written consent
      of the respective author.
    </p>

    <h2>Licence granted over the templates</h2>
    <p>
      For as long as a subscription is active, the entitled workspace is granted
      a simple, non-exclusive, non-transferable and non-sublicensable right to
      reproduce and adapt the templates, checklists and boilerplate provided,
      and to use them for its own quality management system within its own
      organisation.
    </p>
    <p>
      The documents created from them belong to the organisation concerned. The
      right to keep using and retaining those documents, and to present them to
      a notified body or an authority, continues indefinitely after the
      subscription ends — a quality management system would otherwise not be
      demonstrable. What ends with the subscription is only access to new and
      updated templates.
    </p>
    <p>
      Not covered are the passing on, resale, making publicly available or any
      other transfer of the templates in substantially unchanged form to third
      parties, and their use to build a competing offering. Consultancies may
      use the templates in client engagements provided a separate subscription
      exists for each organisation they support.
    </p>
    <p>
      Where separately agreed terms of use exist, those terms prevail over the
      provisions above.
    </p>

    <h2>Data protection</h2>
    <p>
      Information on the processing of personal data is set out in the{" "}
      <a href="/privacy">privacy policy</a>.
    </p>
  </>
);

export default function ImpressumPage() {
  return (
    <LegalDoc
      titleDe="Impressum"
      titleEn="Legal notice"
      updated="14.08.2026"
      de={DE}
      en={EN}
    />
  );
}
