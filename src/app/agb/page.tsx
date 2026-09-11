import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'AGB – RundumWerk24' }

export default function AgbPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16 text-slate-700">
      <Link href="/" className="text-sm text-blue-900 hover:underline">← Zurück zur Startseite</Link>
      <h1 className="text-3xl font-black text-slate-900 mt-6 mb-8">Allgemeine Geschäftsbedingungen</h1>

      <section className="mb-8">
        <h2 className="font-bold text-slate-900 mb-2">§ 1 Geltungsbereich</h2>
        <p>
          Diese Allgemeinen Geschäftsbedingungen gelten für alle Verträge zwischen der GGV BAU GmbH
          (Handelsmarke „RundumWerk24“, nachfolgend „Auftragnehmer“) und ihren Kunden über die
          Erbringung von Leistungen in den Bereichen Umzug, Transport, Reinigung sowie Bau- und
          Renovierungsarbeiten.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="font-bold text-slate-900 mb-2">§ 2 Vertragsschluss</h2>
        <p>
          Ein Vertrag kommt durch die schriftliche oder in Textform (z. B. per E-Mail) erklärte Annahme
          eines Angebots durch den Kunden zustande. Angebote sind freibleibend, sofern nicht ausdrücklich
          als verbindlich gekennzeichnet.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="font-bold text-slate-900 mb-2">§ 3 Preise und Zahlung</h2>
        <p>
          Es gelten die im jeweiligen Angebot genannten Festpreise. Zusatzleistungen, die nicht Bestandteil
          des Angebots waren, werden gesondert vereinbart und berechnet.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="font-bold text-slate-900 mb-2">§ 4 Terminvereinbarung und Rücktritt</h2>
        <p>
          Vereinbarte Termine sind für beide Seiten verbindlich. Eine Terminverschiebung ist bis spätestens
          48 Stunden vor dem vereinbarten Termin kostenfrei möglich.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="font-bold text-slate-900 mb-2">§ 5 Haftung</h2>
        <p>
          Der Auftragnehmer haftet für Schäden, die im Rahmen der Leistungserbringung nachweislich durch
          ihn oder seine Erfüllungsgehilfen verursacht wurden, im Rahmen der bestehenden
          Betriebs- und Transporthaftpflichtversicherung.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="font-bold text-slate-900 mb-2">§ 6 Schlussbestimmungen</h2>
        <p>
          Es gilt das Recht der Bundesrepublik Deutschland. Sollten einzelne Bestimmungen dieser AGB
          unwirksam sein, bleibt die Wirksamkeit der übrigen Bestimmungen unberührt.
        </p>
      </section>

      <p className="text-sm text-slate-400">
        [Platzhalter-Text – vor Livegang durch rechtlich geprüfte, individuelle AGB ersetzen.]
      </p>
    </div>
  )
}
