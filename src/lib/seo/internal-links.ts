import { getGewerkSeoBySlug, getActiveGewerkeSeo } from '@/lib/seo/gewerke-seo'
import { getCityBySlug, getActiveCities } from '@/lib/seo/cities'

export interface InternalLink {
  label: string
  href: string
}

/**
 * Kontrolliertes internes Linking (Phase-2 §15) für eine Gewerk×Stadt-Seite: verwandte
 * Leistungen in derselben Stadt, dasselbe Gewerk in anderen (max. 3) Städten, sowie ein
 * Baukosten-Link, falls das Gewerk einer bekannten Leistung zugeordnet werden kann. Bewusst
 * begrenzt (keine Linkfarm) – siehe MAX_RELATED_*.
 */
const MAX_RELATED_SERVICES = 4
const MAX_RELATED_CITIES = 4

export function getRelatedServiceLinks(gewerkSlug: string, citySlug: string): InternalLink[] {
  const gewerk = getGewerkSeoBySlug(gewerkSlug)
  if (!gewerk) return []
  return gewerk.relatedServices
    .map((slug) => getGewerkSeoBySlug(slug))
    .filter((g): g is NonNullable<typeof g> => !!g)
    .slice(0, MAX_RELATED_SERVICES)
    .map((g) => ({ label: `${g.name} in ${getCityBySlug(citySlug)?.name ?? ''}`.trim(), href: `/handwerker/${g.slug}/${citySlug}` }))
}

export function getRelatedCityLinks(gewerkSlug: string, currentCitySlug: string): InternalLink[] {
  const gewerk = getGewerkSeoBySlug(gewerkSlug)
  if (!gewerk) return []
  return getActiveCities()
    .filter((c) => c.slug !== currentCitySlug)
    .slice(0, MAX_RELATED_CITIES)
    .map((c) => ({ label: `${gewerk.name} in ${c.name}`, href: `/handwerker/${gewerkSlug}/${c.slug}` }))
}

export function getAllActiveGewerkLinks(): InternalLink[] {
  return getActiveGewerkeSeo().map((g) => ({ label: g.name, href: `/handwerker/${g.slug}` }))
}
