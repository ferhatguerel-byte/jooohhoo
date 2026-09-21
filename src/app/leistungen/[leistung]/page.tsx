import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getLeistungBySlug } from '@/lib/seo/leistungen'
import { getGewerkSeoBySlug } from '@/lib/seo/gewerke-seo'
import { getCurrentUser } from '@/lib/current-user'
import HomeHeader from '@/app/HomeHeader'
import SiteFooter from '@/components/layout/SiteFooter'

export const revalidate = 3600

export async function generateMetadata({ params }: { params: Promise<{ leistung: string }> }): Promise<Metadata> {
  const { leistung: slug } = await params
  const leistung = getLeistungBySlug(slug)
  if (!leistung) return {}
  return {
    title: `${leistung.name} – Fachbetriebe & Ablauf | BAUVERSUS`,
    description: leistung.longDescription,
    alternates: { canonical: `/leistungen/${leistung.slug}` },
  }
}

export default async function LeistungPage({ params }: { params: Promise<{ leistung: string }> }) {
  const { leistung: slug } = await params
  const leistung = getLeistungBySlug(slug)
  if (!leistung) notFound()
  const user = await getCurrentUser()
  const relatedGewerke = leistung.relatedGewerkSlugs.map((s) => getGewerkSeoBySlug(s)).filter((g) => !!g)

  return (
    <div className="min-h-screen bg-white">
      <HomeHeader loggedIn={!!user} />
      <div className="max-w-4xl mx-auto px-6 py-16">
        <nav className="text-xs text-slate-400 mb-4">
          <Link href="/leistungen" className="hover:text-slate-600">Leistungen</Link> · {leistung.name}
        </nav>
        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-[#17202a] mb-4">{leistung.name}</h1>
        <p className="text-slate-600 max-w-2xl mb-10 leading-relaxed">{leistung.longDescription}</p>

        <h2 className="text-lg font-bold text-[#17202a] mb-4">Beteiligte Gewerke</h2>
        <div className="flex flex-wrap gap-2 mb-10">
          {relatedGewerke.map((g) => (
            <Link
              key={g!.slug}
              href={`/handwerker/${g!.slug}`}
              className="text-sm border border-slate-200 rounded-full px-4 py-2 text-slate-600 hover:border-brand/40 hover:text-brand transition"
            >
              {g!.name}
            </Link>
          ))}
        </div>

        <Link href={`/baukosten/${leistung.slug}`} className="text-sm font-semibold text-brand hover:underline mb-10 inline-block">
          Kosteninformationen zu {leistung.name} →
        </Link>

        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center mt-6">
          <Link href="/registrieren?rolle=auftraggeber" className="bg-accent hover:bg-accent-hover text-white font-bold py-3 px-6 rounded-lg inline-block">
            Jetzt kostenlos Auftrag erstellen →
          </Link>
        </div>
      </div>
      <SiteFooter />
    </div>
  )
}
