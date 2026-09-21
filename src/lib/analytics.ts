/**
 * Produkt-Analytics (Phase 2.1 §3). Es ist weiterhin KEIN Analytics-Anbieter (GA4, Plausible,
 * PostHog, ...) angebunden – `track()` ist bewusst ein no-op mit Konsolen-Log im Dev-Modus, bis
 * eine bewusste Entscheidung für einen Anbieter getroffen und dessen Consent-/Datenschutz-
 * Anforderungen (Cookie-Banner, Anonymisierung, Auftragsverarbeitung) umgesetzt wurden. Die
 * Callsites in der App sind bereits verdrahtet (siehe Aufrufstellen), damit eine spätere
 * Anbieter-Anbindung nur noch `track()` selbst ändern muss, keine einzelne Callsite.
 *
 * Datenschutz: Payloads dürfen keine personenbezogenen Daten enthalten (keine E-Mail, kein
 * Name, keine IP, kein Freitext) – nur IDs/Slugs/Kategorien/Zahlen, die für sich genommen keine
 * natürliche Person identifizieren. Wird an jeder Aufrufstelle eingehalten (siehe Kommentare).
 *
 * `track()` ist synchron und wirft nie – ein Fehler beim (aktuell nicht existierenden) Versand
 * darf niemals eine Kernfunktion (Auftrag erstellen, Angebot abgeben, ...) blockieren oder zum
 * Absturz bringen.
 */
export const ANALYTICS_EVENTS = {
  SEO_LANDING_VIEW: 'seo_landing_view',
  PROVIDER_PROFILE_VIEW: 'provider_profile_view',
  PROJECT_CTA_CLICK: 'project_cta_click',
  PROJECT_CREATED: 'project_created',
  PROVIDER_CONTACT: 'provider_contact',
  OFFER_RECEIVED: 'offer_received',
  OFFER_OPENED: 'offer_opened',
  OFFER_ACCEPTED: 'offer_accepted',
} as const

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS]

export interface AnalyticsPayload {
  [key: string]: string | number | boolean | undefined
}

export function track(event: AnalyticsEvent, payload: AnalyticsPayload = {}): void {
  try {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[analytics:noop] ${event}`, payload)
    }
    // Absichtlich kein Versand: kein Anbieter angebunden. Integrationspunkt für später.
  } catch {
    // track() darf niemals eine Kernfunktion stören.
  }
}
