import { getDb } from '@/lib/db'

/**
 * Phase 3.6H – zentrale, serverseitige Query-Schicht für das interne Matching-Analytics-Dashboard
 * (`/dashboard/admin/analytics`). Liest AUSSCHLIESSLICH aus `analytics_events` (Migration 0010,
 * Phase 3.6G) – keine Schätzungen, keine clientseitigen Werte, kein externer Anbieter.
 *
 * Bewusst KEINE JOINs auf job_matches/match_notifications/offers/jobs: jede hier berechnete Zahl
 * beruht ausschließlich auf tatsächlich gespeicherten Analytics-Events. Das vermeidet zugleich das
 * in Phase 3.6H §15 benannte Risiko, dass ein JOIN (z.B. 1 Job × 5 Matches × 3 Notifications) einen
 * einfachen COUNT künstlich vervielfacht – hier gibt es keinen solchen JOIN, jede Kennzahl ist ein
 * direkter (ggf. distinct) COUNT über die flache Event-Tabelle.
 *
 * Genau ZWEI DB-Roundtrips für den gesamten Report (Aggregat-Query + Tagesaggregation), unabhängig
 * von der Anzahl der KPIs – keine Query pro Kennzahl (Phase 3.6H §10).
 */

export type AnalyticsRangePreset = '7d' | '30d' | '90d' | 'month' | 'custom'

export interface AnalyticsDateRange {
  preset: AnalyticsRangePreset
  /** Untergrenze, inklusiv. */
  from: Date
  /** Obergrenze, EXKLUSIV (halboffenes Intervall [from, to)). */
  to: Date
}

export interface MatchingFunnelCounts {
  projectCreated: number
  matchCreated: number
  matchNotificationCreated: number
  matchEmailSent: number
  matchNotificationRead: number
  jobViewed: number
  offerReceived: number
  offerAccepted: number
}

/**
 * Eindeutige (COUNT DISTINCT) Entitäten je Event-Typ – Grundlage für die Entity-Conversion-Raten
 * unten. Getrennt von den rohen Event-Counts (Phase 3.6H §4/§5: Event Count != Entity Conversion).
 */
export interface MatchingFunnelUniqueEntities {
  uniqueJobsCreated: number
  uniqueJobsWithMatch: number
  uniqueJobsWithNotification: number
  uniqueNotificationsCreated: number
  uniqueNotificationsRead: number
  uniqueJobsViewed: number
  uniqueJobsWithOffer: number
  uniqueJobsAwarded: number
}

/**
 * Alle sechs Verhältnisse aus Phase 3.6H §5 – jede Rate ausschließlich über eine der oben
 * gebildeten eindeutigen Entitäts-IDs (job_id/notification_id) hergeleitet, nie durch Division
 * zweier unabhängiger Event-Counts. `null` statt einer Zahl, wenn der Nenner 0 ist (kein
 * NaN/Infinity, keine erfundene Rate ohne Datenbasis).
 */
export interface MatchingFunnelConversionRates {
  /** Jobs mit mindestens einem Match / erstellte Jobs. */
  matchPerJob: number | null
  /** Jobs mit mindestens einer Notification / Jobs mit mindestens einem Match. */
  notificationPerMatchedJob: number | null
  /** Notifications mit Read / erzeugte Notifications. */
  readPerNotification: number | null
  /** Jobs mit Job-View / Jobs mit Notification. */
  viewPerNotifiedJob: number | null
  /** Jobs mit Offer / Jobs mit Job-View. */
  offerPerViewedJob: number | null
  /** Jobs mit Award / Jobs mit Offer. */
  awardPerOfferedJob: number | null
}

export interface DailyFunnelRow {
  /** UTC-Kalendertag, ISO-Format (YYYY-MM-DD). */
  day: string
  jobs: number
  matches: number
  notifications: number
  offers: number
  awards: number
}

export interface MatchingFunnelReport {
  range: { from: string; to: string }
  counts: MatchingFunnelCounts
  uniqueEntities: MatchingFunnelUniqueEntities
  conversionRates: MatchingFunnelConversionRates
  daily: DailyFunnelRow[]
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Löst Zeitraum-Query-Parameter (aus `searchParams` einer Server-Component-Seite) IMMER
 * serverseitig zu einem konkreten, UTC-basierten [from, to)-Intervall auf. Wirft nie – ein
 * unbekannter/ungültiger `range`-Wert oder ein unvollständiger/ungültiger `custom`-Zeitraum fällt
 * sicher auf den Default (letzte 30 Tage) zurück, statt fehlerhafte Werte an SQL weiterzureichen
 * (Phase 3.6H §16: Zeitraumparameter werden validiert).
 *
 * `now` ist ausschließlich für Tests injizierbar (Determinismus) – im Produktivbetrieb immer die
 * serverseitige Uhrzeit, nie eine vom Client übermittelte "aktuelle Zeit" (Phase 3.6H §3).
 */
export function resolveAnalyticsDateRange(
  params: { range?: string; from?: string; to?: string },
  now: Date = new Date()
): AnalyticsDateRange {
  const preset = normalizePreset(params.range)

  if (preset === 'custom') {
    const from = parseUtcDayStart(params.from)
    const toDayStart = parseUtcDayStart(params.to)
    if (from && toDayStart && from.getTime() <= toDayStart.getTime()) {
      // to-Tag ist inklusiv gemeint -> exklusive Obergrenze ist der Beginn des Folgetages.
      return { preset: 'custom', from, to: new Date(toDayStart.getTime() + DAY_MS) }
    }
    return defaultRange(now)
  }

  if (preset === 'month') {
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    return { preset: 'month', from, to: now }
  }

  const days = preset === '7d' ? 7 : preset === '90d' ? 90 : 30
  return { preset, from: new Date(now.getTime() - days * DAY_MS), to: now }
}

function normalizePreset(value?: string): AnalyticsRangePreset {
  if (value === '7d' || value === '90d' || value === 'month' || value === 'custom') return value
  return '30d'
}

function parseUtcDayStart(value?: string): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const d = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

function defaultRange(now: Date): AnalyticsDateRange {
  return { preset: '30d', from: new Date(now.getTime() - 30 * DAY_MS), to: now }
}

function ratio(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null
  return numerator / denominator
}

interface AggregateRow {
  project_created: number
  match_created: number
  match_notification_created: number
  match_email_sent: number
  match_notification_read: number
  job_viewed: number
  offer_received: number
  offer_accepted: number
  unique_jobs_created: number
  unique_jobs_with_match: number
  unique_jobs_with_notification: number
  unique_notifications_created: number
  unique_notifications_read: number
  unique_jobs_viewed: number
  unique_jobs_with_offer: number
  unique_jobs_awarded: number
}

interface DailyRow {
  day: string
  jobs: number
  matches: number
  notifications: number
  offers: number
  awards: number
}

/**
 * Liefert den vollständigen Funnel-Report für ein bereits aufgelöstes Zeitintervall. Ausschließlich
 * parametrisierte Queries (from/to als echte Date-Objekte, keine String-Interpolation); die acht
 * Event-Typ-Literale in der SQL sind feste Anwendungskonstanten (siehe ANALYTICS_EVENTS in
 * src/lib/analytics.ts), keine Nutzereingabe.
 */
export async function getMatchingFunnelReport(range: AnalyticsDateRange): Promise<MatchingFunnelReport> {
  const db = getDb()

  const aggregateResult = await db.query<AggregateRow>(
    `SELECT
       COUNT(*) FILTER (WHERE event_type = 'project_created')::int AS project_created,
       COUNT(*) FILTER (WHERE event_type = 'match_created')::int AS match_created,
       COUNT(*) FILTER (WHERE event_type = 'match_notification_created')::int AS match_notification_created,
       COUNT(*) FILTER (WHERE event_type = 'match_email_sent')::int AS match_email_sent,
       COUNT(*) FILTER (WHERE event_type = 'match_notification_read')::int AS match_notification_read,
       COUNT(*) FILTER (WHERE event_type = 'job_viewed')::int AS job_viewed,
       COUNT(*) FILTER (WHERE event_type = 'offer_received')::int AS offer_received,
       COUNT(*) FILTER (WHERE event_type = 'offer_accepted')::int AS offer_accepted,
       COUNT(DISTINCT job_id) FILTER (WHERE event_type = 'project_created')::int AS unique_jobs_created,
       COUNT(DISTINCT job_id) FILTER (WHERE event_type = 'match_created')::int AS unique_jobs_with_match,
       COUNT(DISTINCT job_id) FILTER (WHERE event_type = 'match_notification_created')::int AS unique_jobs_with_notification,
       COUNT(DISTINCT notification_id) FILTER (WHERE event_type = 'match_notification_created')::int AS unique_notifications_created,
       COUNT(DISTINCT notification_id) FILTER (WHERE event_type = 'match_notification_read')::int AS unique_notifications_read,
       COUNT(DISTINCT job_id) FILTER (WHERE event_type = 'job_viewed')::int AS unique_jobs_viewed,
       COUNT(DISTINCT job_id) FILTER (WHERE event_type = 'offer_received')::int AS unique_jobs_with_offer,
       COUNT(DISTINCT job_id) FILTER (WHERE event_type = 'offer_accepted')::int AS unique_jobs_awarded
     FROM analytics_events
     WHERE occurred_at >= $1 AND occurred_at < $2`,
    [range.from, range.to]
  )

  const dailyResult = await db.query<DailyRow>(
    `SELECT
       to_char(date_trunc('day', occurred_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
       COUNT(*) FILTER (WHERE event_type = 'project_created')::int AS jobs,
       COUNT(*) FILTER (WHERE event_type = 'match_created')::int AS matches,
       COUNT(*) FILTER (WHERE event_type = 'match_notification_created')::int AS notifications,
       COUNT(*) FILTER (WHERE event_type = 'offer_received')::int AS offers,
       COUNT(*) FILTER (WHERE event_type = 'offer_accepted')::int AS awards
     FROM analytics_events
     WHERE occurred_at >= $1 AND occurred_at < $2
     GROUP BY date_trunc('day', occurred_at AT TIME ZONE 'UTC')
     ORDER BY date_trunc('day', occurred_at AT TIME ZONE 'UTC') DESC`,
    [range.from, range.to]
  )

  const a = aggregateResult.rows[0]

  const counts: MatchingFunnelCounts = {
    projectCreated: a.project_created,
    matchCreated: a.match_created,
    matchNotificationCreated: a.match_notification_created,
    matchEmailSent: a.match_email_sent,
    matchNotificationRead: a.match_notification_read,
    jobViewed: a.job_viewed,
    offerReceived: a.offer_received,
    offerAccepted: a.offer_accepted,
  }

  const uniqueEntities: MatchingFunnelUniqueEntities = {
    uniqueJobsCreated: a.unique_jobs_created,
    uniqueJobsWithMatch: a.unique_jobs_with_match,
    uniqueJobsWithNotification: a.unique_jobs_with_notification,
    uniqueNotificationsCreated: a.unique_notifications_created,
    uniqueNotificationsRead: a.unique_notifications_read,
    uniqueJobsViewed: a.unique_jobs_viewed,
    uniqueJobsWithOffer: a.unique_jobs_with_offer,
    uniqueJobsAwarded: a.unique_jobs_awarded,
  }

  const conversionRates: MatchingFunnelConversionRates = {
    matchPerJob: ratio(uniqueEntities.uniqueJobsWithMatch, uniqueEntities.uniqueJobsCreated),
    notificationPerMatchedJob: ratio(uniqueEntities.uniqueJobsWithNotification, uniqueEntities.uniqueJobsWithMatch),
    readPerNotification: ratio(uniqueEntities.uniqueNotificationsRead, uniqueEntities.uniqueNotificationsCreated),
    viewPerNotifiedJob: ratio(uniqueEntities.uniqueJobsViewed, uniqueEntities.uniqueJobsWithNotification),
    offerPerViewedJob: ratio(uniqueEntities.uniqueJobsWithOffer, uniqueEntities.uniqueJobsViewed),
    awardPerOfferedJob: ratio(uniqueEntities.uniqueJobsAwarded, uniqueEntities.uniqueJobsWithOffer),
  }

  const daily: DailyFunnelRow[] = dailyResult.rows.map((row) => ({
    day: row.day,
    jobs: row.jobs,
    matches: row.matches,
    notifications: row.notifications,
    offers: row.offers,
    awards: row.awards,
  }))

  return {
    range: { from: range.from.toISOString(), to: range.to.toISOString() },
    counts,
    uniqueEntities,
    conversionRates,
    daily,
  }
}
