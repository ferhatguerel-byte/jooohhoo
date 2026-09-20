import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { MapPin, Star, BadgeCheck, Zap, ArrowLeft } from 'lucide-react'
import { getDb } from '@/lib/db'
import { getResponseTimeStats } from '@/lib/response-time'
import { getCurrentUser } from '@/lib/current-user'
import { buildBreadcrumbJsonLd, buildAggregateRatingJsonLd } from '@/lib/seo/structured-data'
import HomeHeader from '../../HomeHeader'

export const dynamic = 'force-dynamic'

async function getCompany(slug: string) {
  const db = getDb()
  const result = await db.query(
    `SELECT id, company_name, company_slug, gewerke, plz, ort, verification_status, created_at
     FROM users
     WHERE role = 'subunternehmer' AND directory_listed = true AND subscription_status = 'active'
       AND company_slug = $1
     LIMIT 1`,
    [slug]
  )
  return result.rows[0] || null
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const company = await getCompany(slug)
  if (!company) return {}

  const gewerkeText = (company.gewerke || []).join(', ')
  const title = `${company.company_name} – ${gewerkeText} in ${company.ort} | BAUVERSUS`
  const description = `${company.company_name} ist ein Handwerksbetrieb für ${gewerkeText} in ${company.plz} ${company.ort}, gelistet auf BAUVERSUS. Jetzt Angebot anfragen.`

  return {
    title,
    description,
    alternates: { canonical: `/firma/${company.company_slug}` },
  }
}

export default async function CompanyProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const company = await getCompany(slug)
  if (!company) notFound()
  const user = await getCurrentUser()

  const db = getDb()
  const reviewsResult = await db.query(
    `SELECT AVG(rating)::numeric(2,1) AS avg_rating, COUNT(*)::int AS review_count
     FROM reviews WHERE reviewee_id = $1`,
    [company.id]
  )
  const { avg_rating: avgRating, review_count: reviewCount } = reviewsResult.rows[0]

  const recentReviewsResult = await db.query(
    `SELECT rating, comment, created_at FROM reviews WHERE reviewee_id = $1 AND comment IS NOT NULL
     ORDER BY created_at DESC LIMIT 5`,
    [company.id]
  )

  const responseTime = await getResponseTimeStats(company.id)

  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: 'Start', path: '/' },
    { name: 'Branchenbuch', path: '/branchenbuch' },
    { name: company.company_name, path: `/firma/${company.company_slug}` },
  ])

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: company.company_name,
    address: {
      '@type': 'PostalAddress',
      postalCode: company.plz,
      addressLocality: company.ort,
      addressCountry: 'DE',
    },
    ...(reviewCount > 0 ? { aggregateRating: buildAggregateRatingJsonLd(Number(avgRating), reviewCount) } : {}),
  }

  return (
    <div className="min-h-screen bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <HomeHeader loggedIn={!!user} />
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link href="/branchenbuch" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-brand mb-6">
          <ArrowLeft size={14} /> Zurück zum Branchenbuch
        </Link>

        <div className="flex items-start justify-between gap-4 flex-wrap mb-2">
          <h1 className="text-3xl font-black text-[#17202a]">{company.company_name}</h1>
          {company.verification_status === 'verified' && (
            <span className="text-sm font-bold text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1 rounded-full flex items-center gap-1.5">
              <BadgeCheck size={16} /> Verifizierter Betrieb
            </span>
          )}
        </div>

        <p className="text-slate-500 flex items-center gap-1.5 mb-1">
          <MapPin size={16} /> {company.plz} {company.ort}
        </p>
        <p className="text-slate-500 mb-6">Gewerke: {(company.gewerke || []).join(', ')}</p>

        <div className="flex flex-wrap gap-4 mb-8">
          {reviewCount > 0 && (
            <div className="flex items-center gap-1.5 bg-orange-50 border border-orange-200 rounded-lg px-4 py-2">
              <Star size={16} className="fill-accent text-accent" />
              <span className="font-bold text-slate-900">{avgRating}</span>
              <span className="text-sm text-slate-500">({reviewCount} Bewertung{reviewCount === 1 ? '' : 'en'})</span>
            </div>
          )}
          {responseTime && (
            <div className="flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-lg px-4 py-2">
              <Zap size={16} className="text-green-700" />
              <span className="text-sm font-semibold text-green-700">Antwortet meist {responseTime.label}</span>
            </div>
          )}
        </div>

        <p className="text-slate-600 leading-relaxed mb-8">
          {company.company_name} ist ein Handwerksbetrieb im Bereich {(company.gewerke || []).join(', ')} mit Sitz in{' '}
          {company.plz} {company.ort}, aktiv auf BAUVERSUS registriert. Auftraggeber aus der Region können kostenlos
          einen Auftrag einstellen – passende, aktive Betriebe wie {company.company_name} sehen ihn automatisch und
          können sich direkt über die Plattform mit einem Angebot melden.
        </p>

        {recentReviewsResult.rows.length > 0 && (
          <div className="mb-8">
            <h2 className="font-bold text-[#17202a] mb-3">Kundenbewertungen</h2>
            <div className="space-y-3">
              {recentReviewsResult.rows.map((r, i) => (
                <div key={i} className="border border-slate-200 rounded-lg p-4">
                  <div className="flex items-center gap-1 mb-1">
                    {Array.from({ length: 5 }).map((_, starI) => (
                      <Star key={starI} size={14} className={starI < r.rating ? 'fill-accent text-accent' : 'text-slate-200'} />
                    ))}
                  </div>
                  <p className="text-sm text-slate-600">{r.comment}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center">
          <p className="text-slate-700 font-semibold mb-3">
            Haben Sie ein Projekt für {company.company_name}?
          </p>
          <Link
            href="/registrieren?rolle=auftraggeber"
            className="bg-accent hover:bg-accent-hover text-white font-bold py-3 px-6 rounded-lg inline-block"
          >
            Jetzt kostenlos Auftrag erstellen →
          </Link>
        </div>
      </div>
    </div>
  )
}
