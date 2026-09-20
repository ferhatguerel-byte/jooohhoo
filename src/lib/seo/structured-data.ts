import { getAppUrl } from '@/lib/url'

/** BreadcrumbList-JSON-LD aus einer einfachen Pfad-Liste. Nur echte, tatsächlich existierende Pfade. */
export function buildBreadcrumbJsonLd(items: { name: string; path: string }[]) {
  const base = getAppUrl()
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: `${base}${item.path}`,
    })),
  }
}

/**
 * Service-JSON-LD für eine Gewerk/Leistung-Landingpage. Bewusst OHNE aggregateRating/reviews –
 * diese werden nur eingefügt, wenn echte Bewertungsdaten vorhanden sind (siehe
 * buildAggregateRatingJsonLd), niemals erfunden (Phase-2 §11).
 */
export function buildServiceJsonLd(opts: {
  name: string
  description: string
  areaServed?: string
  providerCount?: number
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: opts.name,
    description: opts.description,
    provider: { '@type': 'Organization', name: 'BAUVERSUS' },
    ...(opts.areaServed ? { areaServed: { '@type': 'City', name: opts.areaServed } } : {}),
  }
}

/** Nur aufrufen, wenn reviewCount > 0 – sonst keine aggregateRating einbetten. */
export function buildAggregateRatingJsonLd(avgRating: number, reviewCount: number) {
  return {
    '@type': 'AggregateRating',
    ratingValue: avgRating,
    reviewCount,
  }
}
