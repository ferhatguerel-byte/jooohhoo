import Link from 'next/link'
import type { Metadata } from 'next'
import { MapPin, Star, BadgeCheck } from 'lucide-react'
import { getDb } from '@/lib/db'
import { GEWERKE } from '@/lib/gewerke'
import { buildCompanySlug } from '@/lib/slugify'
import { getCurrentUser } from '@/lib/current-user'
import HomeHeader from '../HomeHeader'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Branchenbuch – Geprüfte Handwerksbetriebe finden',
  description:
    'Durchsuchen Sie geprüfte Handwerksbetriebe auf BAUVERSUS nach Gewerk und Region. Kontaktieren Sie direkt Elektriker, Maler, Sanitärbetriebe und mehr.',
  alternates: { canonical: '/branchenbuch' },
}

export default async function BranchenbuchPage({
  searchParams,
}: {
  searchParams: Promise<{ gewerk?: string }>
}) {
  const { gewerk } = await searchParams
  const user = await getCurrentUser()
  const db = getDb()

  const params: unknown[] = []
  let filterClause = ''
  if (gewerk) {
    params.push(gewerk)
    filterClause = 'AND $1 = ANY(gewerke)'
  }

  const result = await db.query(
    `SELECT id, company_name, gewerke, plz, ort, verification_status,
            (SELECT AVG(rating)::numeric(2,1) FROM reviews WHERE reviewee_id = users.id) AS avg_rating,
            (SELECT COUNT(*)::int FROM reviews WHERE reviewee_id = users.id) AS review_count
     FROM users
     WHERE role = 'subunternehmer' AND directory_listed = true AND subscription_status = 'active'
       AND company_name IS NOT NULL ${filterClause}
     ORDER BY company_name ASC`,
    params
  )
  const companies = result.rows

  return (
    <div className="min-h-screen bg-white">
      <HomeHeader loggedIn={!!user} />
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-accent font-extrabold text-xs uppercase tracking-widest mb-3">Branchenbuch</div>
        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-[#17202a] mb-3">
          Geprüfte Handwerksbetriebe finden
        </h1>
        <p className="text-slate-500 max-w-2xl mb-10">
          Alle hier gelisteten Betriebe sind aktive BAUVERSUS-Mitglieder. Wählen Sie ein Gewerk, um passende
          Handwerksbetriebe in Ihrer Region zu finden, und kontaktieren Sie sie direkt über die Plattform.
        </p>

        <div className="flex flex-wrap gap-2 mb-10">
          <Link
            href="/branchenbuch"
            className={`px-3 py-1.5 rounded-full text-sm border transition ${!gewerk ? 'bg-accent border-accent text-white' : 'border-slate-300 text-slate-600'}`}
          >
            Alle Gewerke
          </Link>
          {GEWERKE.map((g) => (
            <Link
              key={g}
              href={`/branchenbuch?gewerk=${encodeURIComponent(g)}`}
              className={`px-3 py-1.5 rounded-full text-sm border transition ${gewerk === g ? 'bg-accent border-accent text-white' : 'border-slate-300 text-slate-600'}`}
            >
              {g}
            </Link>
          ))}
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {companies.length === 0 && (
            <p className="text-slate-500 col-span-full">Aktuell sind keine Betriebe für dieses Gewerk gelistet.</p>
          )}
          {companies.map((c) => (
            <Link
              key={c.id}
              href={`/branchenbuch/${buildCompanySlug(c.company_name, c.id)}`}
              className="border border-slate-200 rounded-2xl p-5 hover:border-brand/40 hover:shadow-md transition"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <h2 className="font-bold text-[#17202a]">{c.company_name}</h2>
                {c.verification_status === 'verified' && (
                  <BadgeCheck size={18} className="text-blue-600 shrink-0" />
                )}
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
