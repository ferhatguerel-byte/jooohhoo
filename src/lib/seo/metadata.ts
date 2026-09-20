import type { Metadata } from 'next'
import type { SeoPageStatus } from '@/lib/seo/status'

export function fillTemplate(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, value), template)
}

/**
 * Baut die Metadata für eine programmatische Landingpage. `status` steuert robots: nur
 * INDEXABLE-Seiten werden für Suchmaschinen freigegeben (Phase-2 §7/§8) – alles andere
 * (DRAFT/REVIEW/NOINDEX) bekommt explizit noindex,follow, damit interne Links weiterhin
 * PageRank weiterreichen, die Seite selbst aber nicht im Index landet.
 */
export function buildLandingPageMetadata(opts: {
  title: string
  description: string
  canonicalPath: string
  status: SeoPageStatus
}): Metadata {
  const indexable = opts.status === 'INDEXABLE'
  return {
    title: opts.title,
    description: opts.description,
    alternates: { canonical: opts.canonicalPath },
    robots: indexable
      ? { index: true, follow: true }
      : { index: false, follow: true },
    openGraph: {
      title: opts.title,
      description: opts.description,
      url: opts.canonicalPath,
      type: 'website',
    },
  }
}
