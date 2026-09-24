import { getDb } from '@/lib/db'
import { fetchProviderAndCandidateJobs, type CandidateJob } from '@/lib/matching/provider-candidate-jobs'
import { filterProviderForJob, type ExclusionReason } from '@/lib/matching/hard-filter'
import { calculateProviderMatchScore, type MatchScoreResult } from '@/lib/matching/score'
import { getMatchScoreMetricsForProviders } from '@/lib/matching/score-metrics'

export interface ScoredJobResult {
  jobId: string
  eligible: boolean
  exclusionReason?: ExclusionReason
  /** Nur gesetzt, wenn eligible === true. */
  score?: MatchScoreResult
}

/**
 * Matching-Lifecycle – provider-zentriertes Gegenstück zu getScoredProvidersForJob(): Hard Filter
 * → Candidate Jobs → Batch Metrics → Pure Scoring, für EINEN Provider gegen alle für ihn
 * relevanten offenen Jobs. Ruft ausschließlich bestehende, bereits getestete Bausteine auf
 * (filterProviderForJob, calculateProviderMatchScore, getMatchScoreMetricsForProviders) – keine
 * zweite Hard-Filter- oder Score-Logik.
 *
 * getMatchScoreMetricsForProviders() wird mit genau einer providerId aufgerufen: dieselbe Batch-
 * Funktion, die auch die job-zentrierte Pipeline nutzt, funktioniert unverändert auch für ein
 * Array mit einem einzelnen Element.
 */
export async function getScoredJobsForProvider(providerId: string): Promise<ScoredJobResult[]> {
  const data = await fetchProviderAndCandidateJobs(providerId)
  if (!data) return []

  const results: ScoredJobResult[] = []
  const eligibleJobs: CandidateJob[] = []

  for (const job of data.jobs) {
    const hardFilterResult = filterProviderForJob(job, data.provider)
    if (hardFilterResult.eligible) {
      eligibleJobs.push(job)
    } else {
      results.push({ jobId: job.id, eligible: false, exclusionReason: hardFilterResult.exclusionReason })
    }
  }

  if (eligibleJobs.length === 0) return results

  const [lineItemGewerkeByJob, metricsByProvider] = await Promise.all([
    getLineItemGewerkeForJobs(eligibleJobs.map((j) => j.id)),
    getMatchScoreMetricsForProviders([providerId]),
  ])
  const metrics = metricsByProvider.get(providerId) ?? {
    avgRating: null,
    reviewCount: 0,
    responseTime: null,
    offersSubmittedCount: 0,
    wonJobsCount: 0,
  }

  for (const job of eligibleJobs) {
    const scoreJob = {
      gewerk: job.gewerk,
      plz: job.plz,
      budgetMin: job.budgetMin,
      budgetMax: job.budgetMax,
      lineItemGewerke: lineItemGewerkeByJob.get(job.id) ?? [],
    }
    const score = calculateProviderMatchScore(
      scoreJob,
      {
        gewerke: data.provider.gewerke,
        plz: data.provider.plz,
        serviceRadiusKm: data.provider.serviceRadiusKm,
        minProjectSize: data.provider.minProjectSize,
        maxProjectSize: data.provider.maxProjectSize,
        verificationStatus: data.provider.verificationStatus,
      },
      metrics
    )
    results.push({ jobId: job.id, eligible: true, score })
  }

  return results
}

async function getLineItemGewerkeForJobs(jobIds: string[]): Promise<Map<string, string[]>> {
  const db = getDb()
  const result = await db.query<{ job_id: string; gewerk: string }>(
    `SELECT DISTINCT job_id, gewerk FROM job_line_items WHERE job_id = ANY($1::uuid[])`,
    [jobIds]
  )
  const map = new Map<string, string[]>()
  for (const row of result.rows) {
    const list = map.get(row.job_id) ?? []
    list.push(row.gewerk)
    map.set(row.job_id, list)
  }
  return map
}
