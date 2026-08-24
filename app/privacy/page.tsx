import { LegalDoc } from "@/components/legal/LegalDoc";

export const metadata = {
  title: "Datenschutzerklärung / Privacy policy",
  description: "Informationen zur Verarbeitung personenbezogener Daten.",
};

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
      Für den <em>Inhalt</em> dieser Dateien handeln wir als
      Auftragsverarbeiter: Verantwortlicher bleibt Ihr Unternehmen, wir
      verarbeiten die Inhalte ausschließlich weisungsgebunden zum Zweck der
      Speicherung, Versionierung und Anzeige innerhalb Ihres Arbeitsbereichs.
      Eine inhaltliche Auswertung zu eigenen Zwecken findet nicht statt; die
      Dateien werden insbesondere nicht zum Training von KI-Modellen verwendet
      und nicht an KI-Dienste übermittelt.
    </p>
    <p>
      Einen Vertrag zur Auftragsverarbeitung nach Art.&nbsp;28 DSGVO stellen wir
      auf Anfrage unter der oben genannten E-Mail-Adresse bereit. Die in
      Abschnitt&nbsp;5 genannten Dienstleister sind die dabei eingesetzten
      Unterauftragsverarbeiter; über beabsichtigte Änderungen dieser Liste
      informieren wir vorab an die im Arbeitsbereich hinterlegte
      Administrator-Adresse.
    </p>
    <p>
      Bitte laden Sie nur Nachweise hoch, die für den jeweiligen Zweck
      erforderlich sind, und beschränken Sie personenbezogene Daten darin — etwa
      Namen in Schulungsnachweisen oder Unterschriften in Freigaben — auf das
      notwendige Maß. Besondere Kategorien personenbezogener Daten nach
      Art.&nbsp;9 DSGVO, insbesondere Gesundheitsdaten aus klinischen Prüfungen,
      Vorkommnismeldungen oder Reklamationen, gehören nicht in diesen
      Speicherbereich; laden Sie solche Unterlagen bitte ausschließlich
      pseudonymisiert oder anonymisiert hoch.
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

    <h3>Bewerbung zum Startup-Programm</h3>
    <p>
      Bewirbt sich ein Arbeitsbereich um den vergünstigten Preis des
      Startup-Programms, verarbeiten wir die im Antragsformular gemachten
      Angaben: Firmenname, Website, Land, Gründungsmonat, Anzahl der
      Mitarbeitenden, eine Kurzbeschreibung des Produkts, die einschlägige
      Verordnung (MDR oder IVDR) samt Risikoklasse, die bisher aufgenommene
      Finanzierung (Eigenkapital und Förderungen), den Umsatz der letzten zwölf
      Monate sowie Ihre Begründung, warum eine CE-Kennzeichnung derzeit nicht
      finanzierbar ist. Rechtsgrundlage ist Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;b
      DSGVO (vorvertragliche Maßnahmen auf Ihre Anfrage hin).
    </p>
    <p>
      <strong>
        Wird der Antrag über die Subdomain eines Partners gestellt — etwa eines
        Accelerators oder Investors —, wird er von diesem Partner vollständig
        gelesen.
      </strong>{" "}
      Das Formular nennt den Partner vor dem Absenden namentlich. Über die
      allgemeine Adresse gestellte Anträge sehen ausschließlich wir. Ein Partner
      erhält ausschließlich Anträge, die über seine eigene Subdomain eingereicht
      wurden, und keine Entwürfe.
    </p>
    <p>
      Abgelehnte und zurückgezogene Anträge bewahren wir für die Dauer des
      Vertragsverhältnisses auf, damit die Grundlage einer Preisentscheidung
      nachvollziehbar bleibt; ohne Vertragsverhältnis löschen wir sie nach
      zwölf Monaten. Ein bewilligter Antrag bleibt als Nachweis für den
      gewährten Preis erhalten und ist mit dem zugehörigen Kauf verknüpft.
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
        <strong>
          Supabase Pte. Ltd., 65 Chulia Street #38-02/03, OCBC Centre, Singapur
          049513
        </strong>{" "}
        — Datenbank, Authentifizierung und Dateispeicher. Verarbeitung in der
        Region Frankfurt am Main (<code>eu-central-1</code>), Deutschland.
      </li>
      <li>
        <strong>
          Vercel Inc., 440 N Barranca Avenue #4133, Covina, CA 91723, USA
        </strong>{" "}
        — Hosting und Auslieferung der Anwendung, Serverprotokolle. Ausführung
        in der Region Frankfurt am Main (<code>fra1</code>), Deutschland.
      </li>
      <li>
        <strong>
          Stripe Payments Europe, Limited, One Wilton Park, Wilton Place, Dublin
          2, D02&nbsp;FX04, Irland
        </strong>{" "}
        — Zahlungsabwicklung. Vertragspartner und verarbeitende Stelle für
        Kunden im EWR ist die irische Gesellschaft; die Verarbeitung erfolgt in
        der Europäischen Union, mit Übermittlungen an die verbundene Stripe,
        Inc. (USA).
      </li>
      <li>
        <strong>
          Plus Five Five, Inc. (auftretend als „Resend“), 2261 Market Street
          #5039, San Francisco, CA 94114, USA
        </strong>{" "}
        — Versand transaktionaler E-Mails. Die Verarbeitung findet in den
        Vereinigten Staaten statt.
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
      Für Übermittlungen in Drittländer stützen wir uns je Dienstleister auf
      folgende Garantien nach Kapitel&nbsp;V DSGVO:
    </p>
    <ul>
      <li>
        <strong>Supabase</strong> — Standardvertragsklauseln der Europäischen
        Kommission (Durchführungsbeschluss&nbsp;(EU)&nbsp;2021/914), Modul&nbsp;2
        (Verantwortlicher an Auftragsverarbeiter), als Bestandteil des
        Auftragsverarbeitungsvertrags, ergänzt um technische Maßnahmen
        (Verschlüsselung bei Übertragung und im Ruhezustand, Zugriffskontrolle).
      </li>
      <li>
        <strong>Vercel</strong> — Zertifizierung nach dem EU-US Data Privacy
        Framework (Angemessenheitsbeschluss der Europäischen Kommission vom
        10.&nbsp;Juli&nbsp;2023) sowie ergänzend Standardvertragsklauseln aus
        dem Auftragsverarbeitungsvertrag.
      </li>
      <li>
        <strong>Stripe</strong> — Verarbeitung innerhalb der EU durch die
        irische Gesellschaft; für Übermittlungen an verbundene Unternehmen in
        Drittländern Standardvertragsklauseln.
      </li>
      <li>
        <strong>Resend</strong> — Zertifizierung nach dem EU-US Data Privacy
        Framework sowie ergänzend Standardvertragsklauseln.
      </li>
    </ul>
    <p>
      Eine Kopie der jeweiligen Garantien stellen wir auf Anfrage unter der in
      Abschnitt&nbsp;1 genannten Adresse zur Verfügung.
    </p>

    <h2>6. Speicherdauer</h2>
    <p>
      Konto-, Organisations- und Inhaltsdaten werden für die Dauer des
      Vertragsverhältnisses gespeichert. Nach Löschung eines Arbeitsbereichs
      werden die zugehörigen Datensätze und die hinterlegten Nachweisdateien
      entfernt. Rechnungen und sonstige abgabenrechtlich relevante Unterlagen
      werden gemäß § 132 BAO sieben Jahre aufbewahrt.
    </p>
    <p>Im Einzelnen gelten folgende Fristen:</p>
    <ul>
      <li>
        <strong>Technische Serverprotokolle bei Vercel</strong> (IP-Adresse,
        Zeitpunkt, aufgerufene Ressource): automatische Löschung nach der
        Vorhaltezeit des genutzten Tarifs, längstens nach 30&nbsp;Tagen. Ein
        Export dieser Protokolle in Systeme Dritter findet nicht statt.
      </li>
      <li>
        <strong>Protokolle bei Supabase</strong> (Datenbank-, Authentifizierungs-
        und Speicherzugriffe): automatische Löschung nach längstens 7&nbsp;Tagen.
      </li>
      <li>
        <strong>Sicherungskopien der Datenbank</strong>: rollierende Vorhaltung
        von 7&nbsp;Tagen. Ein gelöschter Arbeitsbereich entfällt daher
        spätestens 7&nbsp;Tage nach der Löschung endgültig auch aus den
        Sicherungen. Bis dahin sind die Daten allein für die Wiederherstellung
        im Störungsfall gesperrt und werden nicht weiterverarbeitet.
      </li>
      <li>
        <strong>Nachweisdateien im Dateispeicher</strong>: Löschung unmittelbar
        mit der Löschung des Arbeitsbereichs; sie unterliegen keiner gesonderten
        Sicherungskopie.
      </li>
      <li>
        <strong>Protokolldaten und Änderungshistorie im Produkt</strong>: für
        die Dauer des Vertragsverhältnisses, danach Löschung gemeinsam mit dem
        Arbeitsbereich.
      </li>
    </ul>

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
      For the <em>content</em> of these files we act as a processor: your
      organisation remains the controller, and we process that content solely on
      your instructions for the purpose of storing, versioning and displaying it
      within your workspace. We do not analyse the content for our own purposes;
      in particular the files are not used to train AI models and are not
      transmitted to any AI service.
    </p>
    <p>
      A data processing agreement under Art.&nbsp;28 GDPR is available on
      request at the email address given above. The providers listed in
      section&nbsp;5 are the sub-processors engaged for this purpose; we give
      advance notice of intended changes to that list to the administrator
      address held for the workspace.
    </p>
    <p>
      Please upload only evidence that is necessary for the purpose at hand, and
      keep the personal data it contains — names on training records, signatures
      on approvals — to the minimum required. Special categories of personal
      data under Art.&nbsp;9 GDPR, in particular health data from clinical
      investigations, incident reports or complaints, do not belong in this
      storage area; please upload such records in pseudonymised or anonymised
      form only.
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

    <h3>Startup Programme application</h3>
    <p>
      Where a workspace applies for the discounted Startup Programme price, we
      process what you enter on the application form: company name, website,
      country, month of incorporation, headcount, a short description of the
      product, the applicable regulation (MDR or IVDR) and risk class, funding
      raised to date (equity and grants), revenue over the last twelve months,
      and your account of why CE marking is not currently affordable. The legal
      basis is Art.&nbsp;6(1)(b) GDPR — pre-contractual measures taken at your
      request.
    </p>
    <p>
      <strong>
        Where an application is submitted through a partner&rsquo;s subdomain —
        an accelerator or investor, for instance — that partner reads it in
        full.
      </strong>{" "}
      The form names the partner before you submit. Applications made through
      our main address are seen only by us. A partner receives only applications
      submitted through their own subdomain, and never a draft.
    </p>
    <p>
      Declined and withdrawn applications are kept for the duration of the
      contractual relationship so that the basis of a pricing decision stays
      auditable; where no contract follows, we delete them after twelve months.
      An approved application is retained as the evidence for the price granted
      and is linked to the corresponding purchase.
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
        <strong>
          Supabase Pte. Ltd., 65 Chulia Street #38-02/03, OCBC Centre, Singapore
          049513
        </strong>{" "}
        — database, authentication and file storage. Processing in the Frankfurt
        am Main region (<code>eu-central-1</code>), Germany.
      </li>
      <li>
        <strong>
          Vercel Inc., 440 N Barranca Avenue #4133, Covina, CA 91723, USA
        </strong>{" "}
        — application hosting and delivery, server logs. Execution in the
        Frankfurt am Main region (<code>fra1</code>), Germany.
      </li>
      <li>
        <strong>
          Stripe Payments Europe, Limited, One Wilton Park, Wilton Place, Dublin
          2, D02&nbsp;FX04, Ireland
        </strong>{" "}
        — payment processing. The Irish company is the contracting and
        processing entity for customers in the EEA; processing takes place in
        the European Union, with onward transfers to its affiliate Stripe, Inc.
        (USA).
      </li>
      <li>
        <strong>
          Plus Five Five, Inc. (trading as &ldquo;Resend&rdquo;), 2261 Market
          Street #5039, San Francisco, CA 94114, USA
        </strong>{" "}
        — transactional email delivery. Processing takes place in the United
        States.
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
      For transfers to third countries we rely on the following safeguards under
      Chapter&nbsp;V GDPR, per provider:
    </p>
    <ul>
      <li>
        <strong>Supabase</strong> — the European Commission&rsquo;s standard
        contractual clauses (Implementing Decision (EU) 2021/914), module&nbsp;2
        (controller to processor), as part of the data processing agreement,
        supplemented by technical measures (encryption in transit and at rest,
        access control).
      </li>
      <li>
        <strong>Vercel</strong> — certification under the EU-US Data Privacy
        Framework (European Commission adequacy decision of 10 July 2023), with
        the standard contractual clauses in the data processing agreement as a
        supplementary basis.
      </li>
      <li>
        <strong>Stripe</strong> — processing within the EU by the Irish company;
        standard contractual clauses for transfers to affiliates in third
        countries.
      </li>
      <li>
        <strong>Resend</strong> — certification under the EU-US Data Privacy
        Framework, with standard contractual clauses as a supplementary basis.
      </li>
    </ul>
    <p>
      A copy of the relevant safeguards is available on request at the address
      given in section&nbsp;1.
    </p>

    <h2>6. Retention</h2>
    <p>
      Account, organisation and content data are retained for the duration of
      the contractual relationship. When a workspace is deleted, the associated
      records and stored evidence files are removed. Invoices and other records
      relevant under tax law are retained for seven years pursuant to § 132 of
      the Austrian Federal Fiscal Code (BAO).
    </p>
    <p>The individual periods are:</p>
    <ul>
      <li>
        <strong>Technical server logs at Vercel</strong> (IP address, timestamp,
        resource requested): deleted automatically after the retention window of
        the plan in use, and after 30&nbsp;days at the latest. These logs are not
        exported to any third-party system.
      </li>
      <li>
        <strong>Logs at Supabase</strong> (database, authentication and storage
        access): deleted automatically after 7&nbsp;days at the latest.
      </li>
      <li>
        <strong>Database backups</strong>: retained on a rolling 7-day window. A
        deleted workspace therefore falls out of the backups for good no later
        than 7&nbsp;days after deletion. Until then the data is held solely for
        restoring service after a failure and is not processed further.
      </li>
      <li>
        <strong>Evidence files in storage</strong>: deleted at the same time as
        the workspace; they are not covered by a separate backup.
      </li>
      <li>
        <strong>In-product log data and change history</strong>: kept for the
        duration of the contractual relationship, then deleted together with the
        workspace.
      </li>
    </ul>

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
      updated="19.08.2026"
      de={DE}
      en={EN}
    />
  );
}
