import type { Metadata } from 'next'
import Link from 'next/link'
import { getActiveGewerkeSeo } from '@/lib/seo/gewerke-seo'
import { getCurrentUser } from '@/lib/current-user'
import HomeHeader from '@/app/HomeHeader'
import SiteFooter from '@/components/layout/SiteFooter'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Handwerker finden – nach Gewerk | BAUVERSUS',
  description: 'Handwerksbetriebe nach Gewerk finden: Trockenbau, Maler, Elektro, Sanitär & Heizung und mehr. Auftrag erstellen und vergleichbare Angebote erhalten.',
  alternates: { canonical: '/handwerker' },
}

export default async function HandwerkerIndexPage() {
  const user = await getCurrentUser()
  const gewerke = getActiveGewerkeSeo()

  return (
    <div className="min-h-screen bg-white">
      <HomeHeader loggedIn={!!user} />
      <div className="max-w-4xl mx-auto px-6 py-16">
        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-[#17202a] mb-4">Handwerker finden</h1>
        <p className="text-slate-600 max-w-2xl mb-10">
          Wählen Sie ein Gewerk, um passende Fachbetriebe zu finden – oder erstellen Sie direkt einen Auftrag und
          lassen Sie sich von aktiven Betrieben kontaktieren.
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          {gewerke.map((g) => (
            <Link
              key={g.slug}
              href={`/handwerker/${g.slug}`}
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
