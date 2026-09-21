import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getGewerkSeoBySlug } from '@/lib/seo/gewerke-seo'
import { getCityBySlug } from '@/lib/seo/cities'
import BranchenbuchGewerkOrStadtPage, { buildBranchenbuchMetadata } from '@/components/seo/BranchenbuchGewerkOrStadtPage'

/**
 * Phase 3.6I – Ordner/Parametername von `[gewerk]` auf `[slug]` umbenannt (reines Next.js-
 * Routing-Detail, KEINE URL-Änderung): Next.js verlangt, dass alle Geschwister-Routen auf
 * derselben Baumebene denselben dynamischen Segmentnamen verwenden. `/branchenbuch/[slug]`
 * (einstufiger Gewerk-/Stadt-/Legacy-Firmen-Resolver, siehe ../page.tsx) und dieses zweistufige
 * `[gewerk]/[stadt]` nutzten bislang unterschiedliche Namen für dasselbe erste Segment
 * (`slug` vs. `gewerk`) – das verhinderte den Dev-Server-/Playwright-Start ("You cannot use
 * different slug names for the same dynamic path"). Die tatsächliche URL
 * `/branchenbuch/<gewerk-slug>/<stadt-slug>` bleibt exakt gleich, ebenso Sitemap/Metadata/
 * canonical (diese bauen die URL ohnehin per String-Interpolation, nicht über den Parameternamen).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; stadt: string }>
}): Promise<Metadata> {
  const { slug: gewerkSlug, stadt: citySlug } = await params
  const gewerk = getGewerkSeoBySlug(gewerkSlug)
  const city = getCityBySlug(citySlug)
  if (!gewerk || !city) return {}
  return buildBranchenbuchMetadata({ gewerk, city })
}

export default async function BranchenbuchGewerkStadtPage({
  params,
}: {
  params: Promise<{ slug: string; stadt: string }>
}) {
  const { slug: gewerkSlug, stadt: citySlug } = await params
  const gewerk = getGewerkSeoBySlug(gewerkSlug)
  const city = getCityBySlug(citySlug)
  if (!gewerk || !city) notFound()

  return <BranchenbuchGewerkOrStadtPage gewerk={gewerk} city={city} />
}
