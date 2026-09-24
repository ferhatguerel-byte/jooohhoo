import { describe, it, expect, vi, beforeEach } from 'vitest'

const { fetchProviderAndCandidateJobsMock, getMatchScoreMetricsForProvidersMock, queryMock } = vi.hoisted(() => ({
  fetchProviderAndCandidateJobsMock: vi.fn(),
  getMatchScoreMetricsForProvidersMock: vi.fn(),
  queryMock: vi.fn(),
}))
vi.mock('@/lib/matching/provider-candidate-jobs', () => ({ fetchProviderAndCandidateJobs: fetchProviderAndCandidateJobsMock }))
vi.mock('@/lib/matching/score-metrics', () => ({ getMatchScoreMetricsForProviders: getMatchScoreMetricsForProvidersMock }))
vi.mock('@/lib/db', () => ({ getDb: () => ({ query: queryMock }) }))

import { getScoredJobsForProvider } from '@/lib/matching/scored-jobs'

const provider = {
  id: 'p1',
  gewerke: ['Trockenbau'],
  blockedGewerke: [],
  verifiedGewerke: [],
  accountStatus: 'active' as const,
  subscriptionStatus: 'active' as const,
  plz: '10115',
  serviceRadiusKm: null,
  minProjectSize: null,
  maxProjectSize: null,
  verificationStatus: 'unverified' as const,
}

const emptyMetrics = { avgRating: null, reviewCount: 0, responseTime: null, offersSubmittedCount: 0, wonJobsCount: 0 }

describe('getScoredJobsForProvider — Matching-Lifecycle Provider-zentrierte Scoring-Pipeline', () => {
  beforeEach(() => {
    fetchProviderAndCandidateJobsMock.mockReset()
    getMatchScoreMetricsForProvidersMock.mockReset()
    getMatchScoreMetricsForProvidersMock.mockResolvedValue(new Map([['p1', emptyMetrics]]))
    queryMock.mockReset()
    queryMock.mockResolvedValue({ rows: [] })
  })

  it('gibt eine leere Liste zurück, wenn der Provider nicht existiert', async () => {
    fetchProviderAndCandidateJobsMock.mockResolvedValue(null)
    const result = await getScoredJobsForProvider('unknown')
    expect(result).toEqual([])
  })

  it('passender Job: eligible=true mit berechnetem Score', async () => {
    fetchProviderAndCandidateJobsMock.mockResolvedValue({
      provider,
      jobs: [{ id: 'job-1', gewerk: 'Trockenbau', plz: '10115', budgetMin: null, budgetMax: null }],
    })
    const result = await getScoredJobsForProvider('p1')
    expect(result).toHaveLength(1)
    expect(result[0].jobId).toBe('job-1')
    expect(result[0].eligible).toBe(true)
    expect(result[0].score!.score).toBeGreaterThan(0)
  })

  it('nicht passender Job (Gewerk-Mismatch): eligible=false mit exclusionReason', async () => {
    fetchProviderAndCandidateJobsMock.mockResolvedValue({
      provider,
      jobs: [{ id: 'job-2', gewerk: 'Sanitär', plz: '10115', budgetMin: null, budgetMax: null }],
    })
    const result = await getScoredJobsForProvider('p1')
    expect(result).toEqual([{ jobId: 'job-2', eligible: false, exclusionReason: 'gewerk_mismatch' }])
  })

  it('ruft getMatchScoreMetricsForProviders NUR mit der einen providerId auf (kein N+1)', async () => {
    fetchProviderAndCandidateJobsMock.mockResolvedValue({
      provider,
      jobs: [{ id: 'job-1', gewerk: 'Trockenbau', plz: '10115', budgetMin: null, budgetMax: null }],
    })
    await getScoredJobsForProvider('p1')
    expect(getMatchScoreMetricsForProvidersMock).toHaveBeenCalledWith(['p1'])
  })

  it('ruft Metriken/Line-Items nicht auf, wenn kein Job eligible ist', async () => {
    fetchProviderAndCandidateJobsMock.mockResolvedValue({
      provider,
      jobs: [{ id: 'job-2', gewerk: 'Sanitär', plz: '10115', budgetMin: null, budgetMax: null }],
    })
    await getScoredJobsForProvider('p1')
    expect(getMatchScoreMetricsForProvidersMock).not.toHaveBeenCalled()
  })
})
