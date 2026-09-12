import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Impressum – BAUVERSUS' }

export default function ImpressumPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16 text-slate-700">
      <Link href="/" className="text-sm text-brand hover:underline">← Zurück zur Startseite</Link>
      <h1 className="text-3xl font-black text-slate-900 mt-6 mb-8">Impressum</h1>

      <section className="mb-8">
        <h2 className="font-bold text-slate-900 mb-2">Angaben gemäß § 5 TMG</h2>
        <p>
          GGV BAU GmbH<br />
          Mühlenstr. 8a<br />
          14167 Berlin<br />
          Deutschland
        </p>
        <p className="text-sm text-slate-400 mt-2">
          BAUVERSUS ist eine Marke der GGV BAU GmbH.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="font-bold text-slate-900 mb-2">Vertreten durch</h2>
        <p>
          Ferhat Gürel (Geschäftsführer)
        </p>
      </section>

      <section className="mb-8">
        <h2 className="font-bold text-slate-900 mb-2">Kontakt</h2>
        <p>
          Telefon: 0152 / 52968818<br />
          E-Mail: kontakt@bauversus.de
        </p>
      </section>

      <section className="mb-8">
        <h2 className="font-bold text-slate-900 mb-2">Registereintrag</h2>
        <p>
          Eintragung im Handelsregister.<br />
          Registergericht: Amtsgericht Charlottenburg (Berlin)<br />
          Registernummer: HRB 265074 B
        </p>
      </section>

      <section className="mb-8">
        <h2 className="font-bold text-slate-900 mb-2">Umsatzsteuer-ID</h2>
        <p>
          Umsatzsteuer-Identifikationsnummer gemäß § 27 a Umsatzsteuergesetz:<br />
          DE 455975127
        </p>
      </section>

      <section className="mb-8">
        <h2 className="font-bold text-slate-900 mb-2">Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV</h2>
        <p>
          Ferhat Gürel<br />
          Mühlenstr. 8a<br />
          14167 Berlin
        </p>
      </section>

      <section>
        <h2 className="font-bold text-slate-900 mb-2">EU-Streitschlichtung</h2>
        <p className="text-sm">
          Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:{' '}
          <a className="text-brand hover:underline" href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noopener noreferrer">
            https://ec.europa.eu/consumers/odr/
          </a>. Unsere E-Mail-Adresse finden Sie oben im Impressum. Wir sind nicht bereit oder verpflichtet,
          an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.
        </p>
      </section>
    </div>
  )
}
