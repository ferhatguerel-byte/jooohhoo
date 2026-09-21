'use client'

import Link from 'next/link'
import { track, ANALYTICS_EVENTS, type AnalyticsEvent, type AnalyticsPayload } from '@/lib/analytics'

/**
 * Wie next/link, feuert aber zusätzlich ein Analytics-Event (nur Seiten-Kontext als Payload,
 * keine personenbezogenen Daten) bevor navigiert wird. Standard-Event ist project_cta_click
 * (generischer "Auftrag erstellen"-CTA); provider_contact eignet sich für CTAs, die gezielt
 * einen einzelnen, bereits identifizierten Anbieter kontaktieren (z.B. auf dessen Profilseite).
 */
export default function TrackedCtaLink({
  href,
  className,
  children,
  source,
  event = ANALYTICS_EVENTS.PROJECT_CTA_CLICK,
  extraPayload,
}: {
  href: string
  className?: string
  children: React.ReactNode
  /** Woher der Klick kam, z.B. "handwerker_landing", "homepage_hero" – keine Nutzerdaten. */
  source: string
  event?: AnalyticsEvent
  extraPayload?: AnalyticsPayload
}) {
  return (
    <Link href={href} className={className} onClick={() => track(event, { source, ...extraPayload })}>
      {children}
    </Link>
  )
}
