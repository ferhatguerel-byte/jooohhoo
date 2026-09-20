import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getGewerkSeoBySlug } from '@/lib/seo/gewerke-seo'
import { getCityBySlug } from '@/lib/seo/cities'
import { buildLandingPageMetadata, fillTemplate } from '@/lib/seo/metadata'
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
    intent: 'auftraggeber',
    pageType: 'handwerker',
    basePath: '/handwerker',
  })

  return buildLandingPageMetadata({
    title: fillTemplate(gewerk.seoTitleTemplate, { stadt: city.name }),
    description: fillTemplate(gewerk.seoDescriptionTemplate, { stadt: city.name }),
    canonicalPath: `/handwerker/${gewerk.slug}/${city.slug}`,
    status: evaluation.status,
  })
}

export default async function HandwerkerGewerkStadtPage({
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
      data={{ gewerk, city, intent: 'auftraggeber', pageType: 'handwerker', basePath: '/handwerker' }}
    />
  )
}
