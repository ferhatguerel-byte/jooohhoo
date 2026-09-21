import type { Metadata } from 'next'
import Link from 'next/link'
import { getActiveLeistungen } from '@/lib/seo/leistungen'
import { getCurrentUser } from '@/lib/current-user'
import HomeHeader from '@/app/HomeHeader'
import SiteFooter from '@/components/layout/SiteFooter'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Bauleistungen im Überblick | BAUVERSUS',
  description: 'Typische Bauleistungen und Sanierungsprojekte im Überblick: Badsanierung, Wohnungssanierung, Altbausanierung und mehr.',
  alternates: { canonical: '/leistungen' },
}

export default async function LeistungenIndexPage() {
  const user = await getCurrentUser()
  const leistungen = getActiveLeistungen()

  return (
    <div className="min-h-screen bg-white">
      <HomeHeader loggedIn={!!user} />
      <div className="max-w-4xl mx-auto px-6 py-16">
        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-[#17202a] mb-4">Bauleistungen im Überblick</h1>
        <p className="text-slate-600 max-w-2xl mb-10">
          Größere Bauprojekte kombinieren meist mehrere Gewerke. Hier finden Sie einen Überblick über typische
          Leistungsbilder und die daran beteiligten Gewerke.
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          {leistungen.map((l) => (
            <Link key={l.slug} href={`/leistungen/${l.slug}`} className="border border-slate-200 rounded-xl p-5 hover:border-brand/40 hover:shadow-sm transition">
              <h2 className="font-bold text-[#17202a] mb-1">{l.name}</h2>
              <p className="text-sm text-slate-500">{l.shortDescription}</p>
            </Link>
          ))}
        </div>
      </div>
      <SiteFooter />
    </div>
  )
}
