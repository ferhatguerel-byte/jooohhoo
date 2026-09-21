import type { Metadata } from 'next'
import Link from 'next/link'
import { getActiveGewerkeSeo } from '@/lib/seo/gewerke-seo'
import { getCurrentUser } from '@/lib/current-user'
import HomeHeader from '@/app/HomeHeader'
import SiteFooter from '@/components/layout/SiteFooter'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Nachunternehmer finden – nach Gewerk | BAUVERSUS',
  description: 'Nachunternehmer für Ihr Bauprojekt finden: strukturierte Ausschreibung erstellen und Angebote von Fachbetrieben vergleichen.',
  alternates: { canonical: '/nachunternehmer' },
}

export default async function NachunternehmerIndexPage() {
  const user = await getCurrentUser()
  const gewerke = getActiveGewerkeSeo()

  return (
    <div className="min-h-screen bg-white">
      <HomeHeader loggedIn={!!user} />
      <div className="max-w-4xl mx-auto px-6 py-16">
        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-[#17202a] mb-4">Nachunternehmer finden</h1>
        <p className="text-slate-600 max-w-2xl mb-10">
          Für Bauunternehmen, die Gewerke an Nachunternehmer vergeben möchten: Ausschreibung nach Gewerk erstellen
          und vergleichbare Angebote von Fachbetrieben erhalten.
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          {gewerke.map((g) => (
            <Link
              key={g.slug}
              href={`/nachunternehmer/${g.slug}`}
              className="border border-slate-200 rounded-xl p-5 hover:border-brand/40 hover:shadow-sm transition"
            >
              <h2 className="font-bold text-[#17202a] mb-1">{g.name}</h2>
              <p className="text-sm text-slate-500">{g.shortDescription}</p>
            </Link>
          ))}
        </div>
      </div>
      <SiteFooter />
    </div>
  )
}
