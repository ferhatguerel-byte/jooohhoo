import { getDb } from '@/lib/db'
import { fetchJobAndCandidateProviders } from '@/lib/matching/eligible-providers'
import { filterProviderForJob, type ExclusionReason } from '@/lib/matching/hard-filter'
import { calculateProviderMatchScore, type MatchScoreResult } from '@/lib/matching/score'
import { getMatchScoreMetricsForProviders } from '@/lib/matching/score-metrics'

export interface ScoredProviderResult {
  providerId: string
  eligible: boolean
  exclusionReason?: ExclusionReason
  /** Nur gesetzt, wenn eligible === true. */
  score?: MatchScoreResult
}

/**
 * Phase 3.4 – vollständige (aber noch rein interne) Matching-Pipeline für einen Job:
 *
 *   Hard Filter → Candidate IDs → Batch Metrics → Pure Scoring → Result
 *
 * Noch KEINE Persistierung (keine job_matches-Tabelle), noch KEINE automatische Ausführung bei
 * Job-Erstellung, noch KEINE öffentliche API, noch KEINE Benachrichtigung – diese Funktion wird
 * von nichts im Produktcode aufgerufen, sie ist die Grundlage für eine spätere Phase.
 */
export async function getScoredProvidersForJob(jobId: string): Promise<ScoredProviderResult[]> {
  const data = await fetchJobAndCandidateProviders(jobId)
  if (!data) return []

  const results: ScoredProviderResult[] = []
  const eligibleProviders: typeof data.providers = []

  for (const provider of data.providers) {
    const hardFilterResult = filterProviderForJob(data.job, provider)
    if (hardFilterResult.eligible) {
      eligibleProviders.push(provider)
    } else {
      results.push({ providerId: provider.id, eligible: false, exclusionReason: hardFilterResult.exclusionReason })
    }
  }

  if (eligibleProviders.length === 0) return results

  const [lineItemGewerke, metricsByProvider] = await Promise.all([
    getJobLineItemGewerke(jobId),
    getMatchScoreMetricsForProviders(eligibleProviders.map((p) => p.id)),
  ])

  const scoreJob = { gewerk: data.job.gewerk, plz: data.job.plz, budgetMin: data.job.budgetMin, budgetMax: data.job.budgetMax, lineItemGewerke }

  for (const provider of eligibleProviders) {
    const metrics = metricsByProvider.get(provider.id)
    const score = calculateProviderMatchScore(
      scoreJob,
      {
        gewerke: provider.gewerke,
        plz: provider.plz,
        serviceRadiusKm: provider.serviceRadiusKm,
        minProjectSize: provider.minProjectSize,
        maxProjectSize: provider.maxProjectSize,
        verificationStatus: provider.verificationStatus,
      },
      metrics ?? { avgRating: null, reviewCount: 0, responseTime: null, offersSubmittedCount: 0, wonJobsCount: 0 }
    )
    results.push({ providerId: provider.id, eligible: true, score })
  }

  return results
}

async function getJobLineItemGewerke(jobId: string): Promise<string[]> {
  const db = getDb()
  const result = await db.query<{ gewerk: string }>(
    `SELECT DISTINCT gewerk FROM job_line_items WHERE job_id = $1`,
    [jobId]
  )
  return result.rows.map((r) => r.gewerk)
}
