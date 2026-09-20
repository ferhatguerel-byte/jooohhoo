import Link from 'next/link'
import type { Metadata } from 'next'
import { MapPin, Star, BadgeCheck } from 'lucide-react'
import { getDb } from '@/lib/db'
import { getCurrentUser } from '@/lib/current-user'
import { ensureCompanySlugs } from '@/lib/company-slug'
import type { GewerkSeo } from '@/lib/seo/gewerke-seo'
import type { City } from '@/lib/seo/cities'
import { cityPlzPatterns } from '@/lib/seo/cities'
import HomeHeader from '@/app/HomeHeader'

interface Props {
  gewerk?: GewerkSeo
  city?: City
}

export function buildBranchenbuchMetadata({ gewerk, city }: Props): Metadata {
  const parts = [gewerk?.name, city?.name].filter(Boolean)
  const title = `${parts.join(' in ')} – Branchenbuch | BAUVERSUS`
  const description = gewerk && city
    ? `Geprüfte ${gewerk.name}-Betriebe in ${city.name} im BAUVERSUS-Branchenbuch.`
    : gewerk
    ? `Geprüfte ${gewerk.name}-Betriebe im BAUVERSUS-Branchenbuch.`
    : `Geprüfte Handwerksbetriebe in ${city?.name} im BAUVERSUS-Branchenbuch.`
  const path = gewerk && city ? `/branchenbuch/${gewerk.slug}/${city.slug}` : `/branchenbuch/${gewerk?.slug ?? city?.slug}`

  return { title, description, alternates: { canonical: path } }
}

export default async function BranchenbuchGewerkOrStadtPage({ gewerk, city }: Props) {
  const user = await getCurrentUser()
  const db = getDb()

  const conditions = ["role = 'subunternehmer'", 'directory_listed = true', "subscription_status = 'active'", 'company_name IS NOT NULL']
  const params: unknown[] = []
  if (gewerk) {
    params.push(gewerk.name)
    conditions.push(`$${params.length} = ANY(gewerke)`)
  }
  if (city) {
    params.push(cityPlzPatterns(city))
    conditions.push(`plz LIKE ANY($${params.length}::text[])`)
  }

  const result = await db.query(
    `SELECT id, company_name, company_slug, gewerke, plz, ort, verification_status,
            (SELECT AVG(rating)::numeric(2,1) FROM reviews WHERE reviewee_id = users.id) AS avg_rating,
            (SELECT COUNT(*)::int FROM reviews WHERE reviewee_id = users.id) AS review_count
     FROM users WHERE ${conditions.join(' AND ')} ORDER BY company_name ASC`,
    params
  )
  const companies = await ensureCompanySlugs(result.rows)

  const heading = gewerk && city ? `${gewerk.name} in ${city.name}` : gewerk ? gewerk.name : `Handwerksbetriebe in ${city?.name}`

  return (
    <div className="min-h-screen bg-white">
      <HomeHeader loggedIn={!!user} />
      <div className="max-w-6xl mx-auto px-6 py-16">
        <nav className="text-xs text-slate-400 mb-4">
          <Link href="/branchenbuch" className="hover:text-slate-600">Branchenbuch</Link> · {heading}
        </nav>
        <div className="text-accent font-extrabold text-xs uppercase tracking-widest mb-3">Branchenbuch</div>
        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-[#17202a] mb-3">{heading}</h1>
        <p className="text-slate-500 max-w-2xl mb-10">
          Alle hier gelisteten Betriebe sind aktive BAUVERSUS-Mitglieder. Kontaktieren Sie sie direkt über die
          Plattform, indem Sie einen Auftrag einstellen.
        </p>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {companies.length === 0 && (
            <p className="text-slate-500 col-span-full">Aktuell sind keine Betriebe für diese Auswahl gelistet.</p>
          )}
          {companies.map((c) => (
            <Link
              key={c.id}
              href={`/firma/${c.company_slug}`}
              className="border border-slate-200 rounded-2xl p-5 hover:border-brand/40 hover:shadow-md transition"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <h2 className="font-bold text-[#17202a]">{c.company_name}</h2>
                {c.verification_status === 'verified' && <BadgeCheck size={18} className="text-blue-600 shrink-0" />}
              </div>
              <p className="text-sm text-slate-500 flex items-center gap-1 mb-2">
                <MapPin size={14} /> {c.plz} {c.ort}
              </p>
              <p className="text-xs text-slate-400 mb-2">{(c.gewerke || []).join(' · ')}</p>
              {c.review_count > 0 && (
                <div className="flex items-center gap-1 text-sm text-slate-600">
                  <Star size={14} className="fill-accent text-accent" />
                  {c.avg_rating} ({c.review_count})
                </div>
              )}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
