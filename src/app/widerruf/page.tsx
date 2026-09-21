import type { Metadata } from 'next'
import Link from 'next/link'
import SiteFooter from '@/components/layout/SiteFooter'

export const metadata: Metadata = { title: 'Widerruf – BAUVERSUS' }

/**
 * Phase 4.1 – Diese Seite erfindet KEINEN neuen juristischen Text. Sie verweist ausschließlich auf
 * die bereits bestehende, freigegebene Position in den AGB (§ 3, letzter Absatz): Unternehmer
 * schließen ihr Abo in Ausübung einer gewerblichen/selbständigen beruflichen Tätigkeit (§ 14 BGB),
 * ein gesetzliches Verbraucherwiderrufsrecht nach §§ 312g, 355 BGB besteht daher grundsätzlich nicht.
 * Die Nutzung als Auftraggeber (Auftrag einstellen) ist gemäß AGB § 2 vollständig kostenlos, es kommt
 * dabei kein entgeltlicher Verbrauchervertrag zustande, auf den sich ein Widerruf beziehen könnte.
 *
 * Es existiert im Repository kein weiterer freigegebener Widerrufstext (z. B. eine Muster-
 * Widerrufsbelehrung mit Formular). Ein solcher Text wird hier bewusst NICHT erfunden – er bedarf
 * vor Veröffentlichung einer eigenständigen rechtlichen Prüfung/Freigabe (siehe Hinweis unten).
 */
export default function WiderrufPage() {
  return (
    <>
    <div className="max-w-3xl mx-auto px-6 py-16 text-slate-700">
      <Link href="/" className="text-sm text-brand hover:underline">← Zurück zur Startseite</Link>
      <h1 className="text-3xl font-black text-slate-900 mt-6 mb-8">Widerruf</h1>

      <section className="mb-8">
        <h2 className="font-bold text-slate-900 mb-2">Unternehmer-Abonnements</h2>
        <p>
          Wie in unseren <Link href="/agb" className="text-brand hover:underline">AGB, § 3</Link> dargestellt,
          setzt die Registrierung als Unternehmer und der Abschluss eines Abo-Modells voraus, dass der Nutzer
          in Ausübung seiner gewerblichen oder selbständigen beruflichen Tätigkeit handelt (§ 14 BGB). Ein
          gesetzliches Verbraucherwiderrufsrecht nach §§ 312g, 355 BGB besteht für diese Verträge daher
          grundsätzlich nicht.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="font-bold text-slate-900 mb-2">Auftraggeber</h2>
        <p>
          Die Nutzung als Auftraggeber, insbesondere das Einstellen von Aufträgen, ist gemäß{' '}
          <Link href="/agb" className="text-brand hover:underline">AGB, § 2</Link> dauerhaft kostenfrei. Es
          kommt dabei kein entgeltlicher Vertrag zustande, auf den sich ein Widerruf beziehen könnte.
        </p>
      </section>

      <section>
        <p className="text-sm text-slate-400">
          Hinweis: Für darüberhinausgehende Fallkonstellationen liegt aktuell keine gesonderte,
          freigegebene Widerrufsbelehrung vor. Ein entsprechender Text bedarf vor Veröffentlichung
          einer eigenständigen fachlichen/rechtlichen Freigabe.
        </p>
      </section>
    </div>
    <SiteFooter />
    </>
  )
}
