import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Datenschutzerklärung – BAUVERSUS' }

export default function DatenschutzPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16 text-slate-700">
      <Link href="/" className="text-sm text-brand hover:underline">← Zurück zur Startseite</Link>
      <h1 className="text-3xl font-black text-slate-900 mt-6 mb-8">Datenschutzerklärung</h1>

      <section className="mb-8">
        <h2 className="font-bold text-slate-900 mb-2">1. Verantwortlicher</h2>
        <p>
          Verantwortlicher im Sinne der Datenschutz-Grundverordnung (DSGVO) ist:<br />
          GGV BAU GmbH, Mühlenstr. 8a, 14167 Berlin, E-Mail: kontakt@bauversus.de
        </p>
      </section>

      <section className="mb-8">
        <h2 className="font-bold text-slate-900 mb-2">2. Registrierung und Nutzerkonto</h2>
        <p>
          Bei der Registrierung als Auftraggeber oder Unternehmer erheben wir die von Ihnen angegebenen
          Daten (Firmenname, E-Mail-Adresse, Telefonnummer, Adresse, ggf. Gewerke) sowie ein verschlüsselt
          gespeichertes Passwort. Die Verarbeitung erfolgt zur Erfüllung des Nutzungsvertrags gemäß
          Art. 6 Abs. 1 lit. b DSGVO.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="font-bold text-slate-900 mb-2">3. Aufträge und Angebote</h2>
        <p>
          Von Auftraggebern eingestellte Aufträge (Titel, Gewerk, Ort, Beschreibung, Budget) sind für
          Unternehmer mit aktivem Abo sichtbar. Von Unternehmern abgegebene Angebote (Preis, Nachricht,
          Kontaktdaten) sind für den jeweiligen Auftraggeber sichtbar, sobald ein Angebot abgegeben wurde.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="font-bold text-slate-900 mb-2">4. Zahlungsabwicklung</h2>
        <p>
          Für die Abrechnung der Abo-Gebühren von Unternehmern setzen wir den Zahlungsdienstleister
          Stripe ein. Hierbei werden die zur Zahlungsabwicklung erforderlichen Daten (u. a. E-Mail-Adresse,
          Zahlungsinformationen) an Stripe übermittelt. Weitere Informationen: stripe.com/de/privacy.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="font-bold text-slate-900 mb-2">5. KI-Leistungsverzeichnis und Kostenschätzung</h2>
        <p>
          Beschreibt ein Auftraggeber sein Projekt in freier Sprache, kann daraus mithilfe der Anthropic
          API (Anthropic PBC, USA) automatisiert ein strukturiertes Leistungsverzeichnis sowie eine
          unverbindliche Kostenschätzung erstellt werden. Dabei wird der eingegebene Projekttext an
          Anthropic übermittelt und verarbeitet. Weitere Informationen: anthropic.com/legal/privacy.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="font-bold text-slate-900 mb-2">6. Datei-Uploads</h2>
        <p>
          Bilder und Dokumente, die Auftraggeber einem Auftrag beifügen, sowie Verifizierungsnachweise
          (z. B. Gewerbeanmeldung, Qualifikationsnachweis, Haftpflichtversicherung), die Unternehmer
          hochladen, werden über den Dienst Vercel Blob (Vercel Inc., USA) gespeichert. Verifizierungsnachweise
          sind ausschließlich für den jeweiligen Nutzer und den Betreiber zur Prüfung einsehbar.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="font-bold text-slate-900 mb-2">7. E-Mail-Versand</h2>
        <p>
          Benachrichtigungen (z. B. über neue Angebote, Nachrichten oder zum Zurücksetzen des Passworts)
          versenden wir über den Dienst Resend. Hierbei werden Ihre E-Mail-Adresse sowie der jeweilige
          Nachrichteninhalt an Resend übermittelt.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="font-bold text-slate-900 mb-2">8. Speicherdauer</h2>
        <p>
          Wir speichern Ihre Daten, solange Ihr Nutzerkonto besteht, bzw. so lange, wie dies zur Erfüllung
          gesetzlicher Aufbewahrungspflichten erforderlich ist. Nach Löschung des Kontos werden Daten
          gelöscht oder anonymisiert, soweit keine Aufbewahrungspflichten entgegenstehen.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="font-bold text-slate-900 mb-2">9. Ihre Rechte</h2>
        <p>
          Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung,
          Datenübertragbarkeit sowie Widerspruch gegen die Verarbeitung Ihrer personenbezogenen Daten.
          Zudem steht Ihnen ein Beschwerderecht bei der zuständigen Aufsichtsbehörde zu.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="font-bold text-slate-900 mb-2">10. Cookies</h2>
        <p>
          Diese Website verwendet ein technisch notwendiges Session-Cookie zur Anmeldung im Nutzerkonto.
          Es werden keine Tracking- oder Marketing-Cookies eingesetzt.
        </p>
      </section>
    </div>
  )
}
