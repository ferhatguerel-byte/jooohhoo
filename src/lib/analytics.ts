/**
 * Vorbereitung für Produkt-Analytics (Phase-2 §21). Es ist aktuell KEIN Analytics-Anbieter
 * (GA4, Plausible, PostHog, ...) angebunden – `track()` ist bewusst ein no-op mit Konsolen-Log
 * im Dev-Modus, bis eine bewusste Entscheidung für einen Anbieter getroffen und dessen
 * Consent-/Datenschutz-Anforderungen (Cookie-Banner, Anonymisierung, Auftragsverarbeitung)
 * umgesetzt wurden. Die Event-Namen und Payload-Form sind bereits final, damit spätere
 * Integration ohne Callsite-Änderungen an allen Aufrufstellen möglich ist.
 *
 * Datenschutz: Payloads dürfen keine personenbezogenen Daten enthalten (keine E-Mail, kein
 * Name, keine IP) – nur IDs/Slugs/Kategorien, die für sich genommen keine natürliche Person
 * identifizieren.
 */
export const ANALYTICS_EVENTS = {
  SEO_PAGE_VIEW: 'seo_page_view',
  PROVIDER_PROFILE_VIEW: 'provider_profile_view',
  CALCULATOR_STARTED: 'calculator_started',
  CALCULATOR_COMPLETED: 'calculator_completed',
  LEAD_STARTED: 'lead_started',
  LEAD_CREATED: 'lead_created',
  REGISTRATION_STARTED: 'registration_started',
  REGISTRATION_COMPLETED: 'registration_completed',
  OFFER_RECEIVED: 'offer_received',
  OFFER_ACCEPTED: 'offer_accepted',
} as const

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS]

export interface AnalyticsPayload {
  [key: string]: string | number | boolean | undefined
}

export function track(event: AnalyticsEvent, payload: AnalyticsPayload = {}): void {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[analytics:noop] ${event}`, payload)
  }
  // Absichtlich kein Versand: kein Anbieter angebunden. Integrationspunkt für später.
}
