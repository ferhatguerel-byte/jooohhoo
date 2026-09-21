import { getDb } from '@/lib/db'
import { getResponseTimeStatsBatch } from '@/lib/response-time'
import type { MatchScoreMetrics } from '@/lib/matching/score'

const EMPTY_METRICS: Readonly<MatchScoreMetrics> = {
  avgRating: null,
  reviewCount: 0,
  responseTime: null,
  offersSubmittedCount: 0,
  wonJobsCount: 0,
}

/**
 * Holt alle für den Match Score benötigten echten Plattformdaten (Bewertungen, Reaktionszeit,
 * Angebots-/Auftragshistorie) für eine Menge von Kandidaten in fest 3 zusätzlichen, gebatchten
 * Queries plus dem bestehenden gebatchten getResponseTimeStatsBatch() – unabhängig von der
 * Kandidatenanzahl, keine Einzel-Query pro Provider (Phase 3.4 §14). calculateProviderMatchScore
 * selbst bleibt dadurch eine reine, DB-freie Funktion.
 */
export async function getMatchScoreMetricsForProviders(providerIds: string[]): Promise<Map<string, MatchScoreMetrics>> {
  const result = new Map<string, MatchScoreMetrics>()
  if (providerIds.length === 0) return result
  for (const id of providerIds) result.set(id, { ...EMPTY_METRICS })

  const db = getDb()

  const [reviewsResult, offersResult, wonJobsResult, responseTimeMap] = await Promise.all([
    db.query<{ reviewee_id: string; avg_rating: string | null; review_count: number }>(
      `SELECT reviewee_id, AVG(rating)::numeric(2,1) AS avg_rating, COUNT(*)::int AS review_count
       FROM reviews WHERE reviewee_id = ANY($1::uuid[]) GROUP BY reviewee_id`,
      [providerIds]
    ),
    db.query<{ subunternehmer_id: string; offers_submitted_count: number }>(
      `SELECT subunternehmer_id, COUNT(*)::int AS offers_submitted_count
       FROM offers WHERE subunternehmer_id = ANY($1::uuid[]) GROUP BY subunternehmer_id`,
      [providerIds]
    ),
    db.query<{ awarded_subunternehmer_id: string; won_jobs_count: number }>(
      `SELECT awarded_subunternehmer_id, COUNT(*)::int AS won_jobs_count
       FROM jobs WHERE awarded_subunternehmer_id = ANY($1::uuid[]) GROUP BY awarded_subunternehmer_id`,
      [providerIds]
    ),
    getResponseTimeStatsBatch(providerIds),
  ])

  for (const row of reviewsResult.rows) {
    const entry = result.get(row.reviewee_id)
    if (entry) {
      entry.avgRating = row.avg_rating != null ? Number(row.avg_rating) : null
      entry.reviewCount = row.review_count
    }
  }
  for (const row of offersResult.rows) {
    const entry = result.get(row.subunternehmer_id)
    if (entry) entry.offersSubmittedCount = row.offers_submitted_count
  }
  for (const row of wonJobsResult.rows) {
    const entry = result.get(row.awarded_subunternehmer_id)
    if (entry) entry.wonJobsCount = row.won_jobs_count
  }
  for (const [providerId, stats] of responseTimeMap) {
    const entry = result.get(providerId)
    if (entry) entry.responseTime = stats
  }

  return result
}
