import { describe, it, expect, vi, beforeEach } from 'vitest'

const { queryMock, responseTimeBatchMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
  responseTimeBatchMock: vi.fn(),
}))
vi.mock('@/lib/db', () => ({ getDb: () => ({ query: queryMock }) }))
vi.mock('@/lib/response-time', () => ({ getResponseTimeStatsBatch: responseTimeBatchMock }))

import { getMatchScoreMetricsForProviders } from '@/lib/matching/score-metrics'

describe('getMatchScoreMetricsForProviders — Batch-Metriken (Phase 3.4 §14)', () => {
  beforeEach(() => {
    queryMock.mockReset()
    responseTimeBatchMock.mockReset()
    queryMock.mockResolvedValue({ rows: [] })
    responseTimeBatchMock.mockResolvedValue(new Map())
  })

  it('gibt eine leere Map zurück und führt keine Query aus, wenn keine Kandidaten übergeben werden', async () => {
    const result = await getMatchScoreMetricsForProviders([])
    expect(result.size).toBe(0)
    expect(queryMock).not.toHaveBeenCalled()
    expect(responseTimeBatchMock).not.toHaveBeenCalled()
  })

  it('führt genau 3 SQL-Queries aus, unabhängig von der Kandidatenanzahl (keine N+1)', async () => {
    await getMatchScoreMetricsForProviders(['p1', 'p2', 'p3', 'p4', 'p5'])
    expect(queryMock).toHaveBeenCalledTimes(3)
    expect(responseTimeBatchMock).toHaveBeenCalledTimes(1)
    expect(responseTimeBatchMock).toHaveBeenCalledWith(['p1', 'p2', 'p3', 'p4', 'p5'])
  })

  it('liefert für jeden Kandidaten einen neutralen Default, wenn keine Daten existieren', async () => {
    const result = await getMatchScoreMetricsForProviders(['p1'])
    expect(result.get('p1')).toEqual({
      avgRating: null,
      reviewCount: 0,
      responseTime: null,
      offersSubmittedCount: 0,
      wonJobsCount: 0,
    })
  })

  it('mappt Reviews, Angebote, gewonnene Aufträge und Reaktionszeit korrekt auf den jeweiligen Provider', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ reviewee_id: 'p1', avg_rating: '4.5', review_count: 3 }] })
      .mockResolvedValueOnce({ rows: [{ subunternehmer_id: 'p1', offers_submitted_count: 7 }] })
      .mockResolvedValueOnce({ rows: [{ awarded_subunternehmer_id: 'p1', won_jobs_count: 2 }] })
    responseTimeBatchMock.mockResolvedValueOnce(new Map([['p1', { avgHours: 2, sampleSize: 5, label: 'unter 4 Stunden' }]]))

    const result = await getMatchScoreMetricsForProviders(['p1'])
    expect(result.get('p1')).toEqual({
      avgRating: 4.5,
      reviewCount: 3,
      responseTime: { avgHours: 2, sampleSize: 5, label: 'unter 4 Stunden' },
      offersSubmittedCount: 7,
      wonJobsCount: 2,
    })
  })
})
