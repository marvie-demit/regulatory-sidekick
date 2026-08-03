import { LegalDoc } from "@/components/legal/LegalDoc";

export const metadata = {
  title: "Datenschutzerklärung / Privacy policy",
  description: "Informationen zur Verarbeitung personenbezogener Daten.",
};

function Fill({ children }: { children: React.ReactNode }) {
  return <span className="fillme">{children}</span>;
}

// The data categories below are taken from the actual schema (migrations 0001
// onward) and the actual cookie constants in lib/constants.ts, not from a
// template — keep them in sync when the schema changes.
const DE = (
  <>
    <h2>1. Verantwortlicher</h2>
    <p>
      Verantwortlicher im Sinne der Datenschutz-Grundverordnung (DSGVO) ist:
    </p>
    <dl>
      <dt>Verantwortliche Stelle</dt>
      <dd>
        Marvie Demit, Einzelunternehmen
        <br />
        Gerasdorfer Straße 61/4/2
        <br />
        1210 Wien, Österreich
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
    </dl>
    <p>
      Ein Datenschutzbeauftragter ist nicht bestellt; die Voraussetzungen des
      Art.&nbsp;37 DSGVO liegen nach unserer Einschätzung nicht vor. Anfragen zum
      Datenschutz richten Sie bitte an die oben genannte Adresse.
    </p>

    <h2>2. Welche Daten wir verarbeiten</h2>

    <h3>Konto- und Zugangsdaten</h3>
    <p>
      Bei der Registrierung verarbeiten wir Ihre E-Mail-Adresse, einen von Ihnen
      gewählten Anzeigenamen sowie ein kryptografisch gehashtes Passwort.
      Klartext-Passwörter werden zu keinem Zeitpunkt gespeichert. Ergänzend
      fallen Zeitstempel zur Kontoerstellung, zur E-Mail-Bestätigung und zur
      letzten Anmeldung an.
    </p>

    <h3>Arbeitsbereich und Organisationsprofil</h3>
    <p>
      Zu jedem Arbeitsbereich speichern wir den Namen der Organisation sowie
      optional Website, LinkedIn-Profil, Branche, Land und eine
      Kurzbeschreibung. Hinzu kommen die Zuordnung von Nutzerkonten zu
      Organisationen und die jeweilige Rolle (Administrator oder Mitglied) sowie
      offene Einladungen inklusive der eingeladenen E-Mail-Adresse.
    </p>

    <h3>Nutzungs- und Fortschrittsdaten</h3>
    <p>
      Für die Funktion des Produkts speichern wir den Bearbeitungsstatus von
      Aktivitäten, abgehakte Aufgaben, das Geräte- bzw. Produktprofil des
      Arbeitsbereichs und erreichte Ergebnisse in Wissensabfragen. Diese Daten
      sind der Organisation zugeordnet, nicht der einzelnen Person.
    </p>

    <h3>Von Ihnen hochgeladene Nachweisdokumente</h3>
    <p>
      Sie können Nachweisdateien hochladen. Diese liegen in einem privaten,
      nicht öffentlich adressierbaren Speicherbereich, getrennt nach
      Organisation, und sind ausschließlich für Mitglieder der jeweiligen
      Organisation zugänglich. Der Zugriff wird serverseitig über
      Row-Level-Security erzwungen, nicht allein über die Benutzeroberfläche.
    </p>
    <p>
      <Fill>
        Rechtlich zu prüfen: Enthalten diese Dokumente personenbezogene Daten
        Ihrer Kunden, handeln Sie insoweit als Auftragsverarbeiter. Dann ist ein
        Auftragsverarbeitungsvertrag (AVV) nach Art. 28 DSGVO mit Ihren Kunden
        erforderlich, und dieser Abschnitt muss entsprechend formuliert werden.
      </Fill>
    </p>

    <h3>Protokolldaten und Änderungshistorie</h3>
    <p>
      Sicherheitsrelevante und nachweispflichtige Vorgänge werden in einem
      fortschreibbaren, nicht nachträglich veränderbaren Protokoll festgehalten
      (handelnde Person, Aktion, betroffenes Objekt, Zeitpunkt). Das ist für ein
      Qualitätsmanagementsystem ein funktionales Kernmerkmal. Daneben fallen bei
      unserem Hosting-Dienstleister technische Serverprotokolle an, unter
      anderem mit IP-Adresse, Zeitpunkt und aufgerufener Ressource.
    </p>

    <h3>Zahlungsdaten</h3>
    <p>
      Zahlungen werden über einen externen Zahlungsdienstleister abgewickelt.
      Vollständige Karten- oder Kontodaten erreichen unsere Systeme nicht; wir
      speichern lediglich die Kennungen des Vorgangs, den erworbenen Umfang und
      den Zahlungsstatus.
    </p>

    <h3>Programmatischer Zugriff</h3>
    <p>
      Wird ein Zugriffstoken für die Programmierschnittstelle erstellt,
      speichern wir ausschließlich dessen Hashwert nebst Bezeichnung und
      Zeitstempeln — nicht das Token selbst.
    </p>

    <h2>3. Zwecke und Rechtsgrundlagen</h2>
    <ul>
      <li>
        <strong>Bereitstellung des Dienstes</strong> — Konto, Arbeitsbereich,
        Inhalte und Fortschritt: Art. 6 Abs. 1 lit. b DSGVO (Erfüllung eines
        Vertrags bzw. vorvertragliche Maßnahmen).
      </li>
      <li>
        <strong>Sicherheit, Missbrauchsabwehr, Protokollierung</strong>: Art. 6
        Abs. 1 lit. f DSGVO (berechtigtes Interesse an einem sicheren,
        nachvollziehbaren Betrieb).
      </li>
      <li>
        <strong>Zahlungsabwicklung</strong>: Art. 6 Abs. 1 lit. b DSGVO, in
        Bezug auf handels- und steuerrechtliche Aufbewahrung Art. 6 Abs. 1 lit.
        c DSGVO.
      </li>
      <li>
        <strong>Transaktionale E-Mails</strong> (Bestätigung, Passwortzurück&shy;setzung,
        Einladungen): Art. 6 Abs. 1 lit. b DSGVO.
      </li>
    </ul>

    <h2>4. Cookies</h2>
    <p>
      Wir setzen ausschließlich technisch notwendige Cookies ein. Es findet
      keine Webanalyse, kein Tracking, keine Reichweitenmessung und keine
      Einbindung von Werbenetzwerken statt. Da alle eingesetzten Cookies für die
      Erbringung des ausdrücklich gewünschten Dienstes unbedingt erforderlich
      sind, ist keine Einwilligung einzuholen (§ 165 Abs.&nbsp;3 TKG&nbsp;2021).
    </p>
    <ul>
      <li>
        <code>nja_active_org</code> — merkt sich den aktiven Arbeitsbereich. Die
        Mitgliedschaft wird bei jeder Anfrage serverseitig erneut geprüft; das
        Cookie ist reine Auswahlhilfe.
      </li>
      <li>
        <code>nja_pending_invite</code> — hält eine geöffnete Einladung fest,
        bis die Registrierung abgeschlossen ist.
      </li>
      <li>
        <code>nja_pending_redeem</code> — hält einen geöffneten Freischaltcode
        fest, bis Konto und Arbeitsbereich bestehen.
      </li>
      <li>
        Sitzungscookies der Authentifizierung — halten Sie angemeldet und
        erneuern das Zugriffstoken.
      </li>
    </ul>

    <h2>5. Empfänger und Auftragsverarbeiter</h2>
    <p>
      Wir setzen sorgfältig ausgewählte Dienstleister ein, mit denen Verträge
      zur Auftragsverarbeitung nach Art. 28 DSGVO bestehen:
    </p>
    <ul>
      <li>
        <strong>Supabase</strong> — Datenbank, Authentifizierung und
        Dateispeicher. Verarbeitung in der Region Frankfurt am Main,
        Deutschland.
      </li>
      <li>
        <strong>Vercel</strong> — Hosting und Auslieferung der Anwendung,
        Serverprotokolle. Ausführung in der Region Frankfurt am Main,
        Deutschland.
      </li>
      <li>
        <strong>Stripe</strong> — Zahlungsabwicklung.
      </li>
      <li>
        <strong>Resend</strong> — Versand transaktionaler E-Mails.
      </li>
    </ul>

    <h3>Verarbeitung außerhalb der EU</h3>
    <p>
      Datenbank, Dateispeicher und die Ausführung der Anwendung finden in
      Deutschland statt; dort liegen die Daten auch im Ruhezustand. Beide
      Anbieter sind jedoch US-amerikanische Unternehmen, sodass ein Zugriff aus
      einem Drittland — etwa im Rahmen von Support, Wartung oder Administration
      — nicht generell ausgeschlossen werden kann. Die Wahl einer deutschen
      Region allein beseitigt die Drittlandproblematik daher nicht.
    </p>
    <p>
      <Fill>
        Bitte ergänzen: vollständige Firmierung und Sitz je Dienstleister; die
        konkret einschlägige Transfergrundlage für etwaige Zugriffe aus
        Drittländern (Standardvertragsklauseln bzw. Zertifizierung nach dem
        EU-US Data Privacy Framework); sowie die tatsächliche
        Verarbeitungsregion von Stripe und Resend.
      </Fill>
    </p>

    <h2>6. Speicherdauer</h2>
    <p>
      Konto-, Organisations- und Inhaltsdaten werden für die Dauer des
      Vertragsverhältnisses gespeichert. Nach Löschung eines Arbeitsbereichs
      werden die zugehörigen Datensätze und die hinterlegten Nachweisdateien
      entfernt. Rechnungen und sonstige abgabenrechtlich relevante Unterlagen
      werden gemäß § 132 BAO sieben Jahre aufbewahrt.
    </p>
    <p>
      <Fill>
        Bitte ergänzen: Aufbewahrungsdauer der technischen Serverprotokolle bei
        Vercel und Supabase sowie die Frist, nach der gelöschte Arbeitsbereiche
        endgültig aus den Sicherungskopien entfallen.
      </Fill>
    </p>

    <h2>7. Ihre Rechte</h2>
    <p>
      Sie haben das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16),
      Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18),
      Datenübertragbarkeit (Art. 20) sowie Widerspruch gegen Verarbeitungen, die
      auf einem berechtigten Interesse beruhen (Art. 21 DSGVO). Erteilte
      Einwilligungen können Sie jederzeit mit Wirkung für die Zukunft
      widerrufen.
    </p>
    <p>
      Unabhängig davon steht Ihnen ein Beschwerderecht bei einer
      Datenschutz-Aufsichtsbehörde zu (Art. 77 DSGVO). Für uns zuständig ist die
      Österreichische Datenschutzbehörde, Barichgasse 40–42, 1030 Wien,{" "}
      <a href="mailto:dsb@dsb.gv.at">dsb@dsb.gv.at</a>. Sie können sich ebenso
      an die Aufsichtsbehörde Ihres gewöhnlichen Aufenthaltsorts wenden.
    </p>

    <h2>8. Änderungen dieser Erklärung</h2>
    <p>
      Wir passen diese Datenschutzerklärung an, wenn sich die Verarbeitung oder
      die Rechtslage ändert. Maßgeblich ist die jeweils hier veröffentlichte
      Fassung mit dem oben genannten Stand.
    </p>
  </>
);

const EN = (
  <>
    <h2>1. Controller</h2>
    <p>
      The controller within the meaning of the General Data Protection
      Regulation (GDPR) is:
    </p>
    <dl>
      <dt>Controller</dt>
      <dd>
        Marvie Demit, sole trader
        <br />
        Gerasdorfer Strasse 61/4/2
        <br />
        1210 Vienna, Austria
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
    </dl>
    <p>
      No data protection officer has been appointed; in our assessment the
      criteria of Art.&nbsp;37 GDPR are not met. Please direct data protection
      enquiries to the address above.
    </p>

    <h2>2. What we process</h2>

    <h3>Account and credentials</h3>
    <p>
      On registration we process your email address, a display name you choose,
      and a cryptographically hashed password. Plaintext passwords are never
      stored. We additionally hold timestamps for account creation, email
      confirmation and last sign-in.
    </p>

    <h3>Workspace and organisation profile</h3>
    <p>
      For each workspace we store the organisation name and, optionally,
      website, LinkedIn profile, industry, country and a short description. We
      also store the mapping of user accounts to organisations together with the
      respective role (administrator or member), and any pending invitations
      including the invited email address.
    </p>

    <h3>Usage and progress data</h3>
    <p>
      To make the product work we store the status of activities, completed
      tasks, the workspace&rsquo;s device or product profile, and knowledge-check
      results. This data is associated with the organisation rather than with an
      individual.
    </p>

    <h3>Evidence documents you upload</h3>
    <p>
      You may upload evidence files. These are held in a private, not publicly
      addressable storage area, separated by organisation, and accessible only
      to members of that organisation. Access is enforced server-side through
      row-level security, not merely in the interface.
    </p>
    <p>
      <Fill>
        To be confirmed with counsel: where these documents contain personal
        data belonging to your customers, you act as a processor for that
        content. A data processing agreement under Art. 28 GDPR with your
        customers is then required, and this section must be worded accordingly.
      </Fill>
    </p>

    <h3>Log data and change history</h3>
    <p>
      Security-relevant and auditable events are recorded in an append-only log
      that cannot be altered retrospectively (actor, action, affected object,
      timestamp). For a quality management system this is a core functional
      requirement. Our hosting provider additionally generates technical server
      logs containing, among other things, IP address, timestamp and the
      resource requested.
    </p>

    <h3>Payment data</h3>
    <p>
      Payments are handled by an external payment provider. Full card or account
      details never reach our systems; we retain only the transaction
      identifiers, the scope purchased and the payment status.
    </p>

    <h3>Programmatic access</h3>
    <p>
      Where an access token is created for the application programming
      interface, we store only its hash together with a label and timestamps —
      never the token itself.
    </p>

    <h2>3. Purposes and legal bases</h2>
    <ul>
      <li>
        <strong>Providing the service</strong> — account, workspace, content and
        progress: Art. 6(1)(b) GDPR (performance of a contract or pre-contractual
        measures).
      </li>
      <li>
        <strong>Security, abuse prevention and logging</strong>: Art. 6(1)(f)
        GDPR (legitimate interest in secure and auditable operation).
      </li>
      <li>
        <strong>Payment processing</strong>: Art. 6(1)(b) GDPR, and Art. 6(1)(c)
        GDPR as regards commercial and tax retention obligations.
      </li>
      <li>
        <strong>Transactional email</strong> (confirmation, password reset,
        invitations): Art. 6(1)(b) GDPR.
      </li>
    </ul>

    <h2>4. Cookies</h2>
    <p>
      We use strictly necessary cookies only. There is no web analytics, no
      tracking, no audience measurement and no advertising network embedded.
      Because every cookie in use is strictly necessary to provide the service
      you have explicitly requested, no consent is required (§ 165(3) Austrian
      Telecommunications Act 2021).
    </p>
    <ul>
      <li>
        <code>nja_active_org</code> — remembers the active workspace. Membership
        is re-validated server-side on every request; the cookie is only a
        selector.
      </li>
      <li>
        <code>nja_pending_invite</code> — holds an opened invitation until
        registration is complete.
      </li>
      <li>
        <code>nja_pending_redeem</code> — holds an opened access code until an
        account and workspace exist.
      </li>
      <li>
        Authentication session cookies — keep you signed in and refresh the
        access token.
      </li>
    </ul>

    <h2>5. Recipients and processors</h2>
    <p>
      We use carefully selected providers with whom data processing agreements
      under Art. 28 GDPR are in place:
    </p>
    <ul>
      <li>
        <strong>Supabase</strong> — database, authentication and file storage.
        Processing in the Frankfurt am Main region, Germany.
      </li>
      <li>
        <strong>Vercel</strong> — application hosting and delivery, server logs.
        Execution in the Frankfurt am Main region, Germany.
      </li>
      <li>
        <strong>Stripe</strong> — payment processing.
      </li>
      <li>
        <strong>Resend</strong> — transactional email delivery.
      </li>
    </ul>

    <h3>Processing outside the EU</h3>
    <p>
      The database, file storage and application execution take place in
      Germany, and the data resides there at rest. Both providers are
      nevertheless US companies, so access from a third country — in the course
      of support, maintenance or administration, for instance — cannot be ruled
      out in general. Choosing a German region does not by itself remove the
      third-country question.
    </p>
    <p>
      <Fill>
        To be added: full legal name and seat of each provider; the transfer
        mechanism actually relied upon for any third-country access (standard
        contractual clauses, or certification under the EU-US Data Privacy
        Framework); and the processing regions of Stripe and Resend.
      </Fill>
    </p>

    <h2>6. Retention</h2>
    <p>
      Account, organisation and content data are retained for the duration of
      the contractual relationship. When a workspace is deleted, the associated
      records and stored evidence files are removed. Invoices and other records
      relevant under tax law are retained for seven years pursuant to § 132 of
      the Austrian Federal Fiscal Code (BAO).
    </p>
    <p>
      <Fill>
        Please add: the retention period for technical server logs at Vercel and
        Supabase, and the period after which deleted workspaces fall out of
        backups for good.
      </Fill>
    </p>

    <h2>7. Your rights</h2>
    <p>
      You have the right of access (Art. 15), rectification (Art. 16), erasure
      (Art. 17), restriction of processing (Art. 18), data portability (Art. 20)
      and to object to processing based on legitimate interests (Art. 21 GDPR).
      Any consent given may be withdrawn at any time with effect for the future.
    </p>
    <p>
      You also have the right to lodge a complaint with a data protection
      supervisory authority (Art. 77 GDPR). The authority competent for us is the
      Austrian Data Protection Authority, Barichgasse 40–42, 1030 Vienna,{" "}
      <a href="mailto:dsb@dsb.gv.at">dsb@dsb.gv.at</a>. You may equally contact
      the authority where you habitually reside.
    </p>

    <h2>8. Changes to this notice</h2>
    <p>
      We update this privacy notice when our processing or the legal position
      changes. The version published here, bearing the date shown above, is the
      applicable one.
    </p>
  </>
);

export default function PrivacyPage() {
  return (
    <LegalDoc
      titleDe="Datenschutzerklärung"
      titleEn="Privacy policy"
      updated="31.07.2026"
      de={DE}
      en={EN}
    />
  );
}
