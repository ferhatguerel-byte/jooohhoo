import { describe, it, expect, vi, beforeEach } from 'vitest'

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }))
vi.mock('@/lib/db', () => ({ getDb: () => ({ query: queryMock }) }))

import { getEligibleProvidersForJob } from '@/lib/matching/eligible-providers'

const jobRow = { gewerk: 'Elektro', plz: '10115', budget_min: null, budget_max: null }

describe('getEligibleProvidersForJob — Kandidatenermittlung (Phase 3.3 §10/§11)', () => {
  beforeEach(() => {
    queryMock.mockReset()
  })

  it('gibt eine leere Liste zurück, wenn der Job nicht existiert (keine zweite Query nötig)', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] })
    const result = await getEligibleProvidersForJob('unknown-job')
    expect(result).toEqual([])
    expect(queryMock).toHaveBeenCalledTimes(1)
  })

  it('filtert die Kandidaten-Query bereits per SQL auf role/account_status/subscription_status/gewerk', async () => {
    queryMock.mockResolvedValueOnce({ rows: [jobRow] })
    queryMock.mockResolvedValueOnce({ rows: [] })
    await getEligibleProvidersForJob('job-1')
    const [sql, params] = queryMock.mock.calls[1]
    expect(sql).toContain("role = 'subunternehmer'")
    expect(sql).toContain("account_status = 'active'")
    expect(sql).toContain("subscription_status = 'active'")
    expect(sql).toContain('$1 = ANY(gewerke)')
    expect(params).toEqual(['Elektro'])
  })

  it('wendet den reinen Hard Filter (z.B. Radius) auf die von SQL bereits vorgefilterten Kandidaten an', async () => {
    queryMock.mockResolvedValueOnce({ rows: [jobRow] })
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          id: 'p-near',
          gewerke: ['Elektro'],
          blocked_gewerke: [],
          verified_gewerke: ['Elektro'],
          account_status: 'active',
          subscription_status: 'active',
          plz: '10115',
          service_radius_km: 5,
          min_project_size: null,
          max_project_size: null,
        },
        {
          id: 'p-far',
          gewerke: ['Elektro'],
          blocked_gewerke: [],
          verified_gewerke: ['Elektro'],
          account_status: 'active',
          subscription_status: 'active',
          plz: '80331',
          service_radius_km: 5,
          min_project_size: null,
          max_project_size: null,
        },
      ],
    })
    const result = await getEligibleProvidersForJob('job-1')
    expect(result).toEqual([
      { providerId: 'p-near', eligible: true },
      { providerId: 'p-far', eligible: false, exclusionReason: 'out_of_radius' },
    ])
  })
})
