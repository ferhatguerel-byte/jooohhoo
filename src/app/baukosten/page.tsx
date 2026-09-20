import type { Metadata } from 'next'
import Link from 'next/link'
import { getActiveLeistungen } from '@/lib/seo/leistungen'
import { getCurrentUser } from '@/lib/current-user'
import HomeHeader from '@/app/HomeHeader'

export const revalidate = 3600

// Solange keine der Leistungen echte, validierte Kostendaten hat (siehe leistungen.ts,
// hasCostData), bleibt auch die Übersichtsseite unindexiert – sie würde sonst nur auf
// Unterseiten ohne echten Mehrwert verweisen (Phase-2 §7/§13).
const hasAnyRealCostData = getActiveLeistungen().some((l) => l.hasCostData)

export const metadata: Metadata = {
  title: 'Baukosten – Kostenschätzungen für Bauprojekte | BAUVERSUS',
  description: 'Kostenorientierung für typische Bauprojekte und Sanierungen. Unverbindliche Einschätzung – für ein verlässliches Angebot Auftrag über BAUVERSUS erstellen.',
  alternates: { canonical: '/baukosten' },
  robots: hasAnyRealCostData ? { index: true, follow: true } : { index: false, follow: true },
}

export default async function BaukostenIndexPage() {
  const user = await getCurrentUser()
  const leistungen = getActiveLeistungen()

  return (
    <div className="min-h-screen bg-white">
      <HomeHeader loggedIn={!!user} />
      <div className="max-w-4xl mx-auto px-6 py-16">
        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-[#17202a] mb-4">Baukosten</h1>
        <p className="text-slate-600 max-w-2xl mb-4">
          Wir arbeiten an einer Kostenorientierung auf Basis echter, validierter Marktdaten. Bis dahin gilt: Die
          verlässlichste Kostenschätzung erhalten Sie über ein konkretes Angebot von einem Fachbetrieb.
        </p>
        <p className="text-sm text-slate-400 mb-10">
          Alle künftigen Kostenangaben werden klar als unverbindliche Schätzung gekennzeichnet und beruhen nicht auf
          erfundenen oder geschätzten Platzhalterwerten.
        </p>
        <div className="grid sm:grid-cols-2 gap-4 mb-10">
          {leistungen.map((l) => (
            <Link key={l.slug} href={`/baukosten/${l.slug}`} className="border border-slate-200 rounded-xl p-5 hover:border-brand/40 hover:shadow-sm transition">
              <h2 className="font-bold text-[#17202a] mb-1">{l.name}</h2>
              <p className="text-sm text-slate-500">{l.shortDescription}</p>
            </Link>
          ))}
        </div>
        <Link href="/registrieren?rolle=auftraggeber" className="inline-block bg-accent hover:bg-accent-hover text-white font-bold py-3 px-6 rounded-lg">
          Jetzt Auftrag erstellen und Angebote erhalten →
        </Link>
      </div>
    </div>
  )
}
