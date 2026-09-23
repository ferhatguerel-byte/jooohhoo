import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getGewerkSeoBySlug } from '@/lib/seo/gewerke-seo'
import { getCityBySlug } from '@/lib/seo/cities'
import { buildLandingPageMetadata } from '@/lib/seo/metadata'
import { GewerkStadtLandingPage, evaluateGewerkStadtPage } from '@/components/seo/GewerkStadtLandingPage'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ gewerk: string; stadt: string }>
}): Promise<Metadata> {
  const { gewerk: gewerkSlug, stadt: citySlug } = await params
  const gewerk = getGewerkSeoBySlug(gewerkSlug)
  const city = getCityBySlug(citySlug)
  if (!gewerk || !city) return {}

  const { evaluation } = await evaluateGewerkStadtPage({
    gewerk,
    city,
    intent: 'nachunternehmer',
    pageType: 'nachunternehmer',
    basePath: '/nachunternehmer',
  })

  return buildLandingPageMetadata({
    // Phase 4.5 QA: kein "| BAUVERSUS"-Suffix hier – das Root-Layout hängt "– BAUVERSUS" bereits
    // per Titel-Template an (siehe src/app/layout.tsx), sonst entsteht ein doppelter Markenname.
    title: `${gewerk.name}-Nachunternehmer in ${city.name} finden`,
    description: `Nachunternehmer für ${gewerk.name} in ${city.name} finden: strukturierte Ausschreibung erstellen, Angebote von Fachbetrieben vergleichen.`,
    canonicalPath: `/nachunternehmer/${gewerk.slug}/${city.slug}`,
    status: evaluation.status,
  })
}

export default async function NachunternehmerGewerkStadtPage({
  params,
}: {
  params: Promise<{ gewerk: string; stadt: string }>
}) {
  const { gewerk: gewerkSlug, stadt: citySlug } = await params
  const gewerk = getGewerkSeoBySlug(gewerkSlug)
  const city = getCityBySlug(citySlug)
  if (!gewerk || !city) notFound()

  return (
    <GewerkStadtLandingPage
      data={{ gewerk, city, intent: 'nachunternehmer', pageType: 'nachunternehmer', basePath: '/nachunternehmer' }}
    />
  )
}
