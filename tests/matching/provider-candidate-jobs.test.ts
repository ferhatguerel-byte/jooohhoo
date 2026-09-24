import { describe, it, expect, vi, beforeEach } from 'vitest'

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }))
vi.mock('@/lib/db', () => ({ getDb: () => ({ query: queryMock }) }))

import { fetchProviderAndCandidateJobs } from '@/lib/matching/provider-candidate-jobs'

const providerRow = {
  id: 'p1',
  gewerke: ['Elektro'],
  blocked_gewerke: [],
  verified_gewerke: [],
  account_status: 'active',
  subscription_status: 'active',
  plz: '10115',
  service_radius_km: null,
  min_project_size: null,
  max_project_size: null,
  verification_status: 'unverified',
}

describe('fetchProviderAndCandidateJobs — Matching-Lifecycle Provider-zentrierte Kandidatenermittlung', () => {
  beforeEach(() => {
    queryMock.mockReset()
  })

  it('gibt null zurück, wenn der Provider nicht existiert (keine zweite Query nötig)', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] })
    const result = await fetchProviderAndCandidateJobs('unknown')
    expect(result).toBeNull()
    expect(queryMock).toHaveBeenCalledTimes(1)
  })

  it('filtert die Kandidaten-Job-Query auf role=subunternehmer und status=open', async () => {
    queryMock.mockResolvedValueOnce({ rows: [providerRow] })
    queryMock.mockResolvedValueOnce({ rows: [] })
    await fetchProviderAndCandidateJobs('p1')
    const [providerSql] = queryMock.mock.calls[0]
    expect(providerSql).toContain("role = 'subunternehmer'")
    const [jobsSql, jobsParams] = queryMock.mock.calls[1]
    expect(jobsSql).toContain("status = 'open'")
    expect(jobsParams).toEqual([['Elektro'], 'p1'])
  })

  it('Invalidierungs-Union: Query berücksichtigt sowohl aktuelle Gewerke-Passung als auch bestehende nicht-ausgeschlossene Matches', async () => {
    queryMock.mockResolvedValueOnce({ rows: [providerRow] })
    queryMock.mockResolvedValueOnce({ rows: [] })
    await fetchProviderAndCandidateJobs('p1')
    const [jobsSql] = queryMock.mock.calls[1]
    expect(jobsSql).toContain('gewerk = ANY($1::text[])')
    expect(jobsSql).toContain('SELECT job_id FROM job_matches WHERE provider_id = $2 AND excluded = false')
  })

  it('mappt die Job-Zeilen korrekt auf CandidateJob', async () => {
    queryMock.mockResolvedValueOnce({ rows: [providerRow] })
    queryMock.mockResolvedValueOnce({
      rows: [{ id: 'job-1', gewerk: 'Elektro', plz: '10115', budget_min: 1000, budget_max: 5000 }],
    })
    const result = await fetchProviderAndCandidateJobs('p1')
    expect(result?.jobs).toEqual([{ id: 'job-1', gewerk: 'Elektro', plz: '10115', budgetMin: 1000, budgetMax: 5000 }])
    expect(result?.provider.id).toBe('p1')
  })
})
