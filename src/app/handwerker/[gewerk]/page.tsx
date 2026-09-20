import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getGewerkSeoBySlug } from '@/lib/seo/gewerke-seo'
import { getActiveCities } from '@/lib/seo/cities'
import { getCurrentUser } from '@/lib/current-user'
import HomeHeader from '@/app/HomeHeader'

export const revalidate = 3600

export async function generateMetadata({ params }: { params: Promise<{ gewerk: string }> }): Promise<Metadata> {
  const { gewerk: slug } = await params
  const gewerk = getGewerkSeoBySlug(slug)
  if (!gewerk) return {}
  return {
    title: `${gewerk.name} – Fachbetriebe finden | BAUVERSUS`,
    description: gewerk.longDescription,
    alternates: { canonical: `/handwerker/${gewerk.slug}` },
  }
}

export default async function HandwerkerGewerkPage({ params }: { params: Promise<{ gewerk: string }> }) {
  const { gewerk: slug } = await params
  const gewerk = getGewerkSeoBySlug(slug)
  if (!gewerk) notFound()
  const user = await getCurrentUser()
  const cities = getActiveCities()

  return (
    <div className="min-h-screen bg-white">
      <HomeHeader loggedIn={!!user} />
      <div className="max-w-4xl mx-auto px-6 py-16">
        <nav className="text-xs text-slate-400 mb-4">
          <Link href="/handwerker" className="hover:text-slate-600">Handwerker</Link> · {gewerk.name}
        </nav>
        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-[#17202a] mb-4">{gewerk.name}</h1>
        <p className="text-slate-600 max-w-2xl mb-10 leading-relaxed">{gewerk.longDescription}</p>

        <h2 className="text-lg font-bold text-[#17202a] mb-4">{gewerk.name} in Ihrer Stadt</h2>
        <div className="flex flex-wrap gap-2 mb-10">
          {cities.map((c) => (
            <Link
              key={c.slug}
              href={`/handwerker/${gewerk.slug}/${c.slug}`}
              className="text-sm border border-slate-200 rounded-full px-4 py-2 text-slate-600 hover:border-brand/40 hover:text-brand transition"
            >
              {c.name}
            </Link>
          ))}
        </div>

        <Link href="/registrieren?rolle=auftraggeber" className="inline-block bg-accent hover:bg-accent-hover text-white font-bold py-3 px-6 rounded-lg">
          Jetzt kostenlos Auftrag erstellen →
        </Link>
      </div>
    </div>
  )
}
