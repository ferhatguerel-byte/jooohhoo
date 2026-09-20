import { cache } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { MapPin, Star, BadgeCheck } from 'lucide-react'
import type { GewerkSeo } from '@/lib/seo/gewerke-seo'
import type { City } from '@/lib/seo/cities'
import { getRealProviders, countRealProviders, countRealReviews } from '@/lib/seo/providers'
import { evaluateLandingPage, type SeoPageType } from '@/lib/seo/status'
import { isCuratedCombination } from '@/lib/seo/curated-combinations'
import { getRelatedServiceLinks, getRelatedCityLinks } from '@/lib/seo/internal-links'
import { buildBreadcrumbJsonLd, buildServiceJsonLd, buildAggregateRatingJsonLd } from '@/lib/seo/structured-data'
import { getAppUrl } from '@/lib/url'
import InternalLinks from '@/components/seo/InternalLinks'
import HomeHeader from '@/app/HomeHeader'
import { getCurrentUser } from '@/lib/current-user'

export type LandingIntent = 'auftraggeber' | 'nachunternehmer'

export interface GewerkStadtLandingData {
  gewerk: GewerkSeo
  city: City
  intent: LandingIntent
  pageType: SeoPageType
  basePath: string // '/handwerker' oder '/nachunternehmer'
}

/**
 * Gemeinsame Rendering-Logik für /handwerker/[gewerk]/[stadt] und /nachunternehmer/[gewerk]/[stadt].
 * Lädt echte Anbieterdaten, bewertet die Seite über das Quality Gate und rendert NOINDEX-Seiten
 * inhaltlich identisch (damit Nutzer, die z.B. über einen internen Link kommen, trotzdem eine
 * sinnvolle Seite sehen) – nur robots/Metadata unterscheiden sich (siehe [stadt]/page.tsx).
 */
/**
 * React.cache() dedupliziert pro Request: generateMetadata() und die Page-Komponente laufen
 * beide, würden ohne Cache zweimal dieselbe Auswertung (inkl. DB-Schreibvorgang) auslösen.
 */
export const evaluateGewerkStadtPage = cache(async (data: GewerkStadtLandingData) => {
  const [providers, realProviderCount, realReviewCount] = await Promise.all([
    getRealProviders(data.gewerk.name, data.city),
    countRealProviders(data.gewerk.name, data.city),
    countRealReviews(data.gewerk.name, data.city),
  ])

  const evaluation = await evaluateLandingPage(
    { pageType: data.pageType, gewerkSlug: data.gewerk.slug, citySlug: data.city.slug },
    {
      hasCuratedIntro: false,
      hasLocalFactsInTemplate: true,
      realProviderCount,
      realReviewCount,
      isRecognizedCity: true,
      isRecognizedService: true,
      hasRelatedServices: data.gewerk.relatedServices.length > 0,
      internalLinksCount:
        getRelatedServiceLinks(data.gewerk.slug, data.city.slug).length +
        getRelatedCityLinks(data.gewerk.slug, data.city.slug).length +
        2, // + Baukosten-/Ratgeber-CTA-Links, siehe Render-Funktion
      hasCompleteMetadata: true,
      hasStructuredData: true,
      isCuratedCombination: isCuratedCombination(data.gewerk.slug, data.city.slug),
    }
  )

  return { providers, realProviderCount, realReviewCount, evaluation }
})

export async function GewerkStadtLandingPage({ data }: { data: GewerkStadtLandingData }) {
  const { providers, realReviewCount, evaluation } = await evaluateGewerkStadtPage(data)
  const user = await getCurrentUser()
  const { gewerk, city, intent, basePath } = data
  const canonicalPath = `${basePath}/${gewerk.slug}/${city.slug}`

  const heading = intent === 'auftraggeber' ? `${gewerk.name} in ${city.name}` : `${gewerk.name}-Nachunternehmer in ${city.name}`
  const ctaHref = '/registrieren?rolle=auftraggeber'
  const ctaLabel = intent === 'auftraggeber' ? 'Jetzt kostenlos Auftrag erstellen' : 'Jetzt Nachunternehmer-Ausschreibung erstellen'

  const relatedServiceLinks = getRelatedServiceLinks(gewerk.slug, city.slug)
  const relatedCityLinks = getRelatedCityLinks(gewerk.slug, city.slug)

  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: 'Start', path: '/' },
    { name: intent === 'auftraggeber' ? 'Handwerker' : 'Nachunternehmer', path: basePath },
    { name: gewerk.name, path: `${basePath}/${gewerk.slug}` },
    { name: city.name, path: canonicalPath },
  ])

  const serviceJsonLd = {
    ...buildServiceJsonLd({ name: heading, description: gewerk.shortDescription, areaServed: city.name }),
    ...(realReviewCount > 0 && providers.some((p) => p.reviewCount > 0)
      ? { aggregateRating: buildAggregateRatingJsonLd(providers[0].avgRating || 0, realReviewCount) }
      : {}),
  }

  return (
    <div className="min-h-screen bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }} />
      <HomeHeader loggedIn={!!user} />

      <div className="max-w-4xl mx-auto px-6 py-16">
        <nav className="text-xs text-slate-400 mb-4" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-slate-600">Start</Link> ·{' '}
          <Link href={basePath} className="hover:text-slate-600">{intent === 'auftraggeber' ? 'Handwerker' : 'Nachunternehmer'}</Link> ·{' '}
          <Link href={`${basePath}/${gewerk.slug}`} className="hover:text-slate-600">{gewerk.name}</Link> · {city.name}
        </nav>

        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-[#17202a] mb-4">{heading}</h1>
        <p className="text-slate-600 max-w-2xl mb-8 leading-relaxed">
          {gewerk.longDescription} Auf BAUVERSUS erstellen Sie einen strukturierten Auftrag für {city.name} und
          {' '}erhalten vergleichbare Angebote von aktiven Fachbetrieben – ohne Vermittlungsgebühr für Auftraggeber.
        </p>

        <Link href={ctaHref} className="inline-block bg-accent hover:bg-accent-hover text-white font-bold py-3 px-6 rounded-lg mb-12">
          {ctaLabel} →
        </Link>

        <section className="mb-12">
          <h2 className="text-xl font-bold text-[#17202a] mb-4">
            {providers.length > 0 ? `Aktive ${gewerk.name}-Betriebe in ${city.name}` : `Noch keine gelisteten ${gewerk.name}-Betriebe in ${city.name}`}
          </h2>
          {providers.length === 0 ? (
            <p className="text-slate-500">
              Für {gewerk.name} in {city.name} sind aktuell noch keine Betriebe im Branchenbuch gelistet. Stellen Sie
              trotzdem einen Auftrag ein – passende Betriebe aus der Region erhalten ihn automatisch, sobald sie sich
              registrieren.
            </p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {providers.map((p) => (
                <Link
                  key={p.id}
                  href={`/firma/${p.companySlug}`}
                  className="border border-slate-200 rounded-xl p-4 hover:border-brand/40 hover:shadow-sm transition"
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-bold text-[#17202a] text-sm">{p.companyName}</h3>
                    {p.verificationStatus === 'verified' && <BadgeCheck size={16} className="text-blue-600 shrink-0" />}
                  </div>
                  <p className="text-xs text-slate-500 flex items-center gap-1 mb-1">
                    <MapPin size={12} /> {p.plz} {p.ort}
                  </p>
                  {p.reviewCount > 0 && (
                    <div className="flex items-center gap-1 text-xs text-slate-600">
                      <Star size={12} className="fill-accent text-accent" /> {p.avgRating} ({p.reviewCount})
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="mb-12 bg-slate-50 border border-slate-200 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-[#17202a] mb-2">Kosten für {gewerk.name} in {city.name}</h2>
          <p className="text-sm text-slate-500">
            Eine verlässliche Kostenschätzung hängt stark vom konkreten Projektumfang ab. Erstellen Sie einen Auftrag
            mit Beschreibung und erhalten Sie vergleichbare Angebote von Fachbetrieben – unverbindlich und kostenlos.
          </p>
        </section>

        <div className="space-y-8">
          <InternalLinks title="Verwandte Gewerke in dieser Stadt" links={relatedServiceLinks} />
          <InternalLinks title={`${gewerk.name} in anderen Städten`} links={relatedCityLinks} />
        </div>

        {process.env.NODE_ENV !== 'production' && (
          <p className="mt-12 text-xs text-slate-300">
            [Debug] Quality-Status: {evaluation.status} · Score: {evaluation.score}/100
          </p>
        )}
      </div>
    </div>
  )
}

export function requireGewerkOrNotFound<T>(value: T | undefined): T {
  if (!value) notFound()
  return value
}

export function landingPageUrl(basePath: string, gewerkSlug: string, citySlug: string): string {
  return `${getAppUrl()}${basePath}/${gewerkSlug}/${citySlug}`
}
