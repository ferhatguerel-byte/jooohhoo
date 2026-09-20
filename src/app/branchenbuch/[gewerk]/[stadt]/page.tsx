import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getGewerkSeoBySlug } from '@/lib/seo/gewerke-seo'
import { getCityBySlug } from '@/lib/seo/cities'
import BranchenbuchGewerkOrStadtPage, { buildBranchenbuchMetadata } from '@/components/seo/BranchenbuchGewerkOrStadtPage'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ gewerk: string; stadt: string }>
}): Promise<Metadata> {
  const { gewerk: gewerkSlug, stadt: citySlug } = await params
  const gewerk = getGewerkSeoBySlug(gewerkSlug)
  const city = getCityBySlug(citySlug)
  if (!gewerk || !city) return {}
  return buildBranchenbuchMetadata({ gewerk, city })
}

export default async function BranchenbuchGewerkStadtPage({
  params,
}: {
  params: Promise<{ gewerk: string; stadt: string }>
}) {
  const { gewerk: gewerkSlug, stadt: citySlug } = await params
  const gewerk = getGewerkSeoBySlug(gewerkSlug)
  const city = getCityBySlug(citySlug)
  if (!gewerk || !city) notFound()

  return <BranchenbuchGewerkOrStadtPage gewerk={gewerk} city={city} />
}
