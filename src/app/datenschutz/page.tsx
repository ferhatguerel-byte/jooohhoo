import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Datenschutzerklärung – RundumWerk24' }

export default function DatenschutzPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16 text-slate-700">
      <Link href="/" className="text-sm text-blue-900 hover:underline">← Zurück zur Startseite</Link>
      <h1 className="text-3xl font-black text-slate-900 mt-6 mb-8">Datenschutzerklärung</h1>

      <section className="mb-8">
        <h2 className="font-bold text-slate-900 mb-2">1. Verantwortlicher</h2>
        <p>
          Verantwortlicher im Sinne der Datenschutz-Grundverordnung (DSGVO) ist:<br />
          RundumWerk24 GmbH, Musterstraße 1, 10115 Berlin, E-Mail: anfrage@rundumwerk24.de
        </p>
      </section>

      <section className="mb-8">
        <h2 className="font-bold text-slate-900 mb-2">2. Erhebung und Speicherung personenbezogener Daten</h2>
        <p>
          Beim Ausfüllen unseres Anfrage-/Angebotsformulars erheben wir die von Ihnen eingegebenen Daten
          (Name, E-Mail-Adresse, Telefonnummer, gewünschte Leistung, Wunschtermin sowie Ihre Nachricht),
          um Ihre Anfrage zu bearbeiten und Ihnen ein Angebot zu erstellen. Die Verarbeitung erfolgt auf
          Grundlage von Art. 6 Abs. 1 lit. b DSGVO (vorvertragliche Maßnahmen) bzw. Art. 6 Abs. 1 lit. f DSGVO
          (berechtigtes Interesse an der Bearbeitung von Anfragen).
        </p>
      </section>

      <section className="mb-8">
        <h2 className="font-bold text-slate-900 mb-2">3. Weitergabe von Daten</h2>
        <p>
          Eine Übermittlung Ihrer Daten an Dritte erfolgt nur, soweit dies zur Vertragsdurchführung
          erforderlich ist (z. B. an von uns eingesetzte Auftragsverarbeiter für den technischen Betrieb
          dieser Website und den E-Mail-Versand) oder Sie ausdrücklich eingewilligt haben.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="font-bold text-slate-900 mb-2">4. Speicherdauer</h2>
        <p>
          Wir speichern Ihre Daten nur so lange, wie dies zur Bearbeitung Ihrer Anfrage bzw. zur Erfüllung
          gesetzlicher Aufbewahrungspflichten erforderlich ist.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="font-bold text-slate-900 mb-2">5. Ihre Rechte</h2>
        <p>
          Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung,
          Datenübertragbarkeit sowie Widerspruch gegen die Verarbeitung Ihrer personenbezogenen Daten.
          Zudem steht Ihnen ein Beschwerderecht bei der zuständigen Aufsichtsbehörde zu.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="font-bold text-slate-900 mb-2">6. Cookies</h2>
        <p>
          Diese Website verwendet ausschließlich technisch notwendige Funktionen. Es werden keine
          Tracking- oder Marketing-Cookies eingesetzt.
        </p>
      </section>

      <p className="text-sm text-slate-400">
        [Platzhalter-Text – vor Livegang durch eine rechtssichere, individuell geprüfte Datenschutzerklärung
        ersetzen, insbesondere sobald weitere Dienste wie Analyse- oder Marketing-Tools eingebunden werden.]
      </p>
    </div>
  )
}
