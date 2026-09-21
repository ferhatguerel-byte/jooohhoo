/**
 * Produkt-Analytics (Phase 2.1 §3, erweitert um Phase 3.6G). Es ist weiterhin KEIN externer
 * Analytics-Anbieter (GA4, Plausible, PostHog, ...) angebunden.
 *
 * ZWEI GETRENNTE SCHREIBWEGE, EIN GEMEINSAMES EVENT-VOKABULAR (Phase 3.6G Architektur-Audit):
 * 1. `track()` (diese Datei) – bleibt bewusst ein synchroner no-op mit Konsolen-Log im Dev-Modus.
 *    Grund: diese Datei wird auch von CLIENT-Komponenten importiert (z.B.
 *    src/components/seo/TrackedCtaLink.tsx, ein 'use client'-Button). Ein First-Party-Postgres-
 *    Schreibzugriff über die rohe `pg`-Bibliothek (siehe src/lib/db.ts) kann im Browser-Bundle
 *    nicht laufen (kein TCP-Socket im Browser) – `track()` hier zu einer echten DB-Schreibfunktion
 *    zu machen, würde entweder den Client-Build brechen oder eine neue öffentliche Analytics-API
 *    erfordern (in Phase 3.6G Teil 13 explizit ausgeschlossen). Bleibt daher unverändert.
 * 2. `trackEvent()`/`trackEventsBatch()` (NEU, src/lib/analytics-events.ts) – echte First-Party-
 *    PostgreSQL-Persistenz (Tabelle `analytics_events`, Migration 0010). Ausschließlich aus
 *    serverseitigem Code aufrufbar (Route Handler, Server Components, Matching-Pipeline) – nie aus
 *    einer 'use client'-Datei importieren.
 * Beide Wege teilen sich dieselben Event-Namen in ANALYTICS_EVENTS unten (ein zentrales Vokabular,
 * keine zweite verstreute String-Konstanten-Liste).
 *
 * WIEDERVERWENDUNG BESTEHENDER EVENT-NAMEN (Phase 3.6G Teil 3, keine Duplizierung): der Funnel-
 * Schritt "Angebot abgegeben" nutzt das bereits bestehende OFFER_RECEIVED ('offer_received'), der
 * Schritt "Auftrag vergeben" das bereits bestehende OFFER_ACCEPTED ('offer_accepted') – beide
 * werden jetzt zusätzlich über trackEvent() in analytics_events persistiert (siehe die jeweiligen
 * Aufrufstellen), es gibt bewusst KEINE neuen Konstanten OFFER_CREATED/JOB_AWARDED dafür.
 *
 * Datenschutz: Payloads/Metadata dürfen keine personenbezogenen Daten enthalten (keine E-Mail,
 * kein Name, keine IP, kein Freitext) – nur IDs/Slugs/Kategorien/Zahlen/Booleans, die für sich
 * genommen keine natürliche Person identifizieren. Wird an jeder Aufrufstelle eingehalten (siehe
 * Kommentare dort).
 *
 * `track()` ist synchron und wirft nie – ein Fehler darf niemals eine Kernfunktion (Auftrag
 * erstellen, Angebot abgeben, ...) blockieren oder zum Absturz bringen. `trackEvent()`/
 * `trackEventsBatch()` sind async, aber ebenfalls best-effort und werfen nie (siehe dort).
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
  // Phase 3.6G – Matching-Funnel (persistiert über trackEvent()/trackEventsBatch(), siehe oben).
  MATCH_CREATED: 'match_created',
  MATCH_NOTIFICATION_CREATED: 'match_notification_created',
  MATCH_EMAIL_SENT: 'match_email_sent',
  MATCH_NOTIFICATION_READ: 'match_notification_read',
  JOB_VIEWED: 'job_viewed',
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
