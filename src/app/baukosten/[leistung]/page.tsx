import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getLeistungBySlug } from '@/lib/seo/leistungen'
import { getCurrentUser } from '@/lib/current-user'
import HomeHeader from '@/app/HomeHeader'
import SiteFooter from '@/components/layout/SiteFooter'

export const revalidate = 3600

export async function generateMetadata({ params }: { params: Promise<{ leistung: string }> }): Promise<Metadata> {
  const { leistung: slug } = await params
  const leistung = getLeistungBySlug(slug)
  if (!leistung) return {}
  return {
    // Phase 4.5 QA: kein "| BAUVERSUS"-Suffix hier – das Root-Layout hängt "– BAUVERSUS" bereits
    // per Titel-Template an (siehe src/app/layout.tsx), sonst entsteht ein doppelter Markenname.
    title: `${leistung.name} Kosten – unverbindliche Einschätzung`,
    description: `Kostenorientierung für ${leistung.name}. Für ein verlässliches Angebot: Auftrag über BAUVERSUS erstellen und Angebote von Fachbetrieben vergleichen.`,
    alternates: { canonical: `/baukosten/${leistung.slug}` },
    // NOINDEX bis echte, validierte Kostendaten vorliegen (leistung.hasCostData) – siehe
    // Phase-2 §7/§13: "Noch keine erfundenen Preiswerte."
    robots: leistung.hasCostData ? { index: true, follow: true } : { index: false, follow: true },
  }
}

export default async function BaukostenLeistungPage({ params }: { params: Promise<{ leistung: string }> }) {
  const { leistung: slug } = await params
  const leistung = getLeistungBySlug(slug)
  if (!leistung) notFound()
  const user = await getCurrentUser()

  return (
    <div className="min-h-screen bg-white">
      <HomeHeader loggedIn={!!user} />
      <div className="max-w-3xl mx-auto px-6 py-16">
        <nav className="text-xs text-slate-400 mb-4">
          <Link href="/baukosten" className="hover:text-slate-600">Baukosten</Link> · {leistung.name}
        </nav>
        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-[#17202a] mb-4">{leistung.name}: Kosten</h1>

        {leistung.hasCostData ? (
          <p className="text-slate-600 mb-8">Kostendaten folgen hier, sobald validiert.</p>
        ) : (
          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-6 mb-8">
            <p className="text-slate-700 font-semibold mb-2">Noch keine validierten Kostendaten verfügbar</p>
            <p className="text-sm text-slate-600">
              Wir veröffentlichen hier erst Kostenspannen, sobald sie auf echten, validierten Marktdaten beruhen –
              keine geschätzten Platzhalterwerte. Die verlässlichste Einschätzung für Ihr konkretes Projekt erhalten
              Sie über ein Angebot von einem Fachbetrieb.
            </p>
          </div>
        )}

        <p className="text-slate-600 mb-8 leading-relaxed">{leistung.longDescription}</p>

        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center">
          <Link href="/registrieren?rolle=auftraggeber" className="bg-accent hover:bg-accent-hover text-white font-bold py-3 px-6 rounded-lg inline-block">
            Jetzt kostenlos Auftrag erstellen →
          </Link>
        </div>
      </div>
      <SiteFooter />
    </div>
  )
}
