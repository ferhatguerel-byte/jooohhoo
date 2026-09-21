import { describe, it, expect, vi, beforeEach } from 'vitest'

const { queryMock, responseTimeBatchMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
  responseTimeBatchMock: vi.fn(),
}))
vi.mock('@/lib/db', () => ({ getDb: () => ({ query: queryMock }) }))
vi.mock('@/lib/response-time', () => ({ getResponseTimeStatsBatch: responseTimeBatchMock }))

import { getScoredProvidersForJob } from '@/lib/matching/scored-providers'

const jobRow = { gewerk: 'Elektro', plz: '10115', budget_min: null, budget_max: null }

function providerRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'p1',
    gewerke: ['Elektro'],
    blocked_gewerke: [],
    verified_gewerke: ['Elektro'],
    account_status: 'active',
    subscription_status: 'active',
    plz: '10115',
    service_radius_km: null,
    min_project_size: null,
    max_project_size: null,
    verification_status: 'verified',
    ...overrides,
  }
}

describe('getScoredProvidersForJob — vollständige Pipeline (Phase 3.4)', () => {
  beforeEach(() => {
    queryMock.mockReset()
    responseTimeBatchMock.mockReset()
    responseTimeBatchMock.mockResolvedValue(new Map())
  })

  it('gibt eine leere Liste zurück, wenn der Job nicht existiert', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] })
    const result = await getScoredProvidersForJob('unknown')
    expect(result).toEqual([])
  })

  it('nimmt für Hard-Filter-ausgeschlossene Provider keinen Score-Query-Aufwand vor', async () => {
    queryMock.mockResolvedValueOnce({ rows: [jobRow] }) // job
    queryMock.mockResolvedValueOnce({ rows: [providerRow({ gewerke: ['Fliesenleger'] })] }) // candidates (gewerk mismatch)

    const result = await getScoredProvidersForJob('job-1')
    expect(result).toEqual([{ providerId: 'p1', eligible: false, exclusionReason: 'gewerk_mismatch' }])
    // Keine weiteren Queries für Metriken/LineItems, da kein eligible Provider übrig ist.
    expect(queryMock).toHaveBeenCalledTimes(2)
    expect(responseTimeBatchMock).not.toHaveBeenCalled()
  })

  it('berechnet für eligible Provider einen Score und batcht die Metriken-Queries', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [jobRow] }) // job
      .mockResolvedValueOnce({ rows: [providerRow()] }) // candidates
      .mockResolvedValueOnce({ rows: [{ gewerk: 'Elektro' }] }) // job_line_items
      .mockResolvedValueOnce({ rows: [] }) // reviews
      .mockResolvedValueOnce({ rows: [] }) // offers
      .mockResolvedValueOnce({ rows: [] }) // won jobs

    const result = await getScoredProvidersForJob('job-1')
    expect(result).toHaveLength(1)
    expect(result[0].eligible).toBe(true)
    expect(result[0].score).toBeDefined()
    expect(typeof result[0].score!.score).toBe('number')
    expect(result[0].exclusionReason).toBeUndefined()
  })

  it('mischt eligible und ausgeschlossene Provider im selben Ergebnis korrekt', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [jobRow] })
      .mockResolvedValueOnce({
        rows: [providerRow({ id: 'eligible-1' }), providerRow({ id: 'blocked-1', blocked_gewerke: ['Elektro'] })],
      })
      .mockResolvedValueOnce({ rows: [] }) // job_line_items
      .mockResolvedValueOnce({ rows: [] }) // reviews
      .mockResolvedValueOnce({ rows: [] }) // offers
      .mockResolvedValueOnce({ rows: [] }) // won jobs

    const result = await getScoredProvidersForJob('job-1')
    const byId = Object.fromEntries(result.map((r) => [r.providerId, r]))
    expect(byId['eligible-1'].eligible).toBe(true)
    expect(byId['eligible-1'].score).toBeDefined()
    expect(byId['blocked-1']).toEqual({ providerId: 'blocked-1', eligible: false, exclusionReason: 'blocked_gewerk' })
  })
})
