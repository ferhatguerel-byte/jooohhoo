import Link from 'next/link'
import type { Metadata } from 'next'
import { MapPin, Star, BadgeCheck } from 'lucide-react'
import { getDb } from '@/lib/db'
import { getCurrentUser } from '@/lib/current-user'
import { ensureCompanySlugs } from '@/lib/company-slug'
import type { GewerkSeo } from '@/lib/seo/gewerke-seo'
import type { City } from '@/lib/seo/cities'
import { cityPlzPatterns } from '@/lib/seo/cities'
import { evaluateLandingPage } from '@/lib/seo/status'
import { isCuratedCombination } from '@/lib/seo/curated-combinations'
import { buildLandingPageMetadata } from '@/lib/seo/metadata'
import { buildBreadcrumbJsonLd, buildServiceJsonLd } from '@/lib/seo/structured-data'
import { getRelatedServiceLinks, getRelatedCityLinks } from '@/lib/seo/internal-links'
import InternalLinks from '@/components/seo/InternalLinks'
import JsonLd from '@/components/seo/JsonLd'
import SiteFooter from '@/components/layout/SiteFooter'
import HomeHeader from '@/app/HomeHeader'
import { track, ANALYTICS_EVENTS } from '@/lib/analytics'

interface Props {
  gewerk?: GewerkSeo
  city?: City
}

interface CompanyRow {
  id: string
  company_name: string
  company_slug: string | null
  gewerke: string[]
  plz: string
  ort: string
  verification_status: string
  avg_rating: number | null
  review_count: number
}

/**
 * Lädt die Firmen einmalig und liefert sowohl die Liste als auch die daraus abgeleiteten
 * Zähler (Anbieter/Bewertungen) zurück – vermeidet zusätzliche COUNT-Queries für das Quality
 * Gate (Phase 2.1 §9: "Keine unnötigen N+1 Queries").
 */
async function loadCompanies(gewerk?: GewerkSeo, city?: City) {
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

  const result = await db.query<CompanyRow>(
    `SELECT id, company_name, company_slug, gewerke, plz, ort, verification_status,
            (SELECT AVG(rating)::numeric(2,1) FROM reviews WHERE reviewee_id = users.id) AS avg_rating,
            (SELECT COUNT(*)::int FROM reviews WHERE reviewee_id = users.id) AS review_count
     FROM users WHERE ${conditions.join(' AND ')} ORDER BY company_name ASC`,
    params
  )
  return ensureCompanySlugs(result.rows)
}

/** Nur für die Gewerk×Stadt-Kombination relevant: Kategorie-Seiten (nur Gewerk ODER nur Stadt) sind ein kleines, festes Set und bleiben immer indexierbar. */
async function evaluateBranchenbuchCombo(gewerk: GewerkSeo, city: City, companies: Awaited<ReturnType<typeof loadCompanies>>) {
  const realProviderCount = companies.length
  const realReviewCount = companies.reduce((sum, c) => sum + (c.review_count || 0), 0)
  const relatedServiceLinks = getRelatedServiceLinks(gewerk.slug, city.slug, '/branchenbuch')
  const relatedCityLinks = getRelatedCityLinks(gewerk.slug, city.slug, '/branchenbuch')

  return evaluateLandingPage(
    { pageType: 'branchenbuch_kombi', gewerkSlug: gewerk.slug, citySlug: city.slug },
    {
      hasCuratedIntro: false,
      hasLocalFactsInTemplate: true,
      realProviderCount,
      realReviewCount,
      isRecognizedCity: true,
      isRecognizedService: true,
      hasRelatedServices: gewerk.relatedServices.length > 0,
      internalLinksCount: relatedServiceLinks.length + relatedCityLinks.length + 1,
      hasCompleteMetadata: true,
      hasStructuredData: true,
      isCuratedCombination: isCuratedCombination(gewerk.slug, city.slug),
    }
  )
}

export async function buildBranchenbuchMetadata({ gewerk, city }: Props): Promise<Metadata> {
  const parts = [gewerk?.name, city?.name].filter(Boolean)
  const title = `${parts.join(' in ')} – Branchenbuch | BAUVERSUS`
  const description = gewerk && city
    ? `Geprüfte ${gewerk.name}-Betriebe in ${city.name} im BAUVERSUS-Branchenbuch.`
    : gewerk
    ? `Geprüfte ${gewerk.name}-Betriebe im BAUVERSUS-Branchenbuch.`
    : `Geprüfte Handwerksbetriebe in ${city?.name} im BAUVERSUS-Branchenbuch.`

  // Nur die Gewerk×Stadt-Kombination durchläuft das Quality Gate; reine Gewerk- oder
  // Stadt-Übersichten sind ein kleines, festes Kategorie-Set und bleiben immer indexierbar.
  if (gewerk && city) {
    const companies = await loadCompanies(gewerk, city)
    const evaluation = await evaluateBranchenbuchCombo(gewerk, city, companies)
    return buildLandingPageMetadata({
      title,
      description,
      canonicalPath: `/branchenbuch/${gewerk.slug}/${city.slug}`,
      status: evaluation.status,
    })
  }

  const path = `/branchenbuch/${gewerk?.slug ?? city?.slug}`
  return { title, description, alternates: { canonical: path } }
}

export default async function BranchenbuchGewerkOrStadtPage({ gewerk, city }: Props) {
  const user = await getCurrentUser()
  const companies = await loadCompanies(gewerk, city)
  const heading = gewerk && city ? `${gewerk.name} in ${city.name}` : gewerk ? gewerk.name : `Handwerksbetriebe in ${city?.name}`

  const isCombo = !!(gewerk && city)
  const evaluation = isCombo ? await evaluateBranchenbuchCombo(gewerk!, city!, companies) : null

  if (isCombo) {
    // Keine personenbezogenen Daten: nur Seiten-Identität und Bewertungsergebnis.
    track(ANALYTICS_EVENTS.SEO_LANDING_VIEW, {
      pageType: 'branchenbuch_kombi',
      gewerkSlug: gewerk!.slug,
      citySlug: city!.slug,
      status: evaluation!.status,
    })
  }

  const breadcrumbItems = [
    { name: 'Start', path: '/' },
    { name: 'Branchenbuch', path: '/branchenbuch' },
    ...(gewerk ? [{ name: gewerk.name, path: `/branchenbuch/${gewerk.slug}` }] : []),
    ...(city ? [{ name: city.name, path: isCombo ? `/branchenbuch/${gewerk!.slug}/${city.slug}` : `/branchenbuch/${city.slug}` }] : []),
  ]
  const breadcrumbJsonLd = buildBreadcrumbJsonLd(breadcrumbItems)
  // Kein aggregateRating hier: diese Seite bündelt mehrere unabhängige Betriebe – eine
  // "Gesamtbewertung" für die Kategorie wäre entweder erfunden oder (wenn aus einer einzelnen
  // Firma übernommen) irreführende Structured Data. Echte Bewertungen gehören auf die jeweilige
  // Firmenseite (/firma/[slug]), wo Rating und Reviewcount tatsächlich zusammengehören.
  const serviceJsonLd = gewerk
    ? buildServiceJsonLd({ name: heading, description: gewerk.shortDescription, areaServed: city?.name })
    : null

  const relatedServiceLinks = isCombo ? getRelatedServiceLinks(gewerk!.slug, city!.slug, '/branchenbuch') : []
  const relatedCityLinks = isCombo ? getRelatedCityLinks(gewerk!.slug, city!.slug, '/branchenbuch') : []

  return (
    <div className="min-h-screen bg-white">
      <JsonLd data={breadcrumbJsonLd} />
      {serviceJsonLd && <JsonLd data={serviceJsonLd} />}
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

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
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

        {isCombo && (
          <div className="space-y-8">
            <InternalLinks title="Verwandte Gewerke in dieser Stadt" links={relatedServiceLinks} />
            <InternalLinks title={`${gewerk!.name} in anderen Städten`} links={relatedCityLinks} />
          </div>
        )}

        {process.env.NODE_ENV !== 'production' && evaluation && (
          <p className="mt-12 text-xs text-slate-300">
            [Debug] Quality-Status: {evaluation.status} · Score: {evaluation.score}/100
          </p>
        )}
      </div>
      <SiteFooter />
    </div>
  )
}
