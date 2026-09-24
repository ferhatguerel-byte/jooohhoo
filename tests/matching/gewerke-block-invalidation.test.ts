import { describe, it, expect, vi, beforeEach } from 'vitest'

const { queryMock, trackEventsBatchMock, createMatchNotificationsForProviderMock, sendMatchNotificationEmailsMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
  trackEventsBatchMock: vi.fn(),
  createMatchNotificationsForProviderMock: vi.fn(),
  sendMatchNotificationEmailsMock: vi.fn(),
}))
vi.mock('@/lib/db', () => ({ getDb: () => ({ query: queryMock }) }))
vi.mock('@/lib/analytics-events', () => ({ trackEventsBatch: trackEventsBatchMock }))
// createMatchNotificationsForProvider/sendMatchNotificationEmails sind bereits eigenständig
// getestet (create-match-notifications.test.ts) – hier nur isoliert, damit dieser Test
// ausschließlich das Zusammenspiel provider-candidate-jobs -> hard-filter -> scored-jobs ->
// buildJobMatchesUpsertQuery end-to-end (mit echter Logik, nur die DB gemockt) prüft.
vi.mock('@/lib/matching/create-match-notifications', () => ({
  createMatchNotificationsForProvider: createMatchNotificationsForProviderMock,
}))
vi.mock('@/lib/matching/send-match-notification-emails', () => ({ sendMatchNotificationEmails: sendMatchNotificationEmailsMock }))

import { matchProviderAgainstOpenJobs } from '@/lib/matching/run-provider-matching'

const PROVIDER_ID = 'p1'
const JOB_ID = 'job-1'

const providerRow = (blockedGewerke: string[]) => ({
  id: PROVIDER_ID,
  gewerke: ['Trockenbau'],
  blocked_gewerke: blockedGewerke,
  verified_gewerke: [],
  account_status: 'active',
  subscription_status: 'active',
  plz: '10115',
  service_radius_km: null,
  min_project_size: null,
  max_project_size: null,
  verification_status: 'unverified',
})

const jobRow = { id: JOB_ID, gewerk: 'Trockenbau', plz: '10115', budget_min: null, budget_max: null }

describe('Matching-Lifecycle — Gewerke-Sperre invalidiert einen bestehenden Match end-to-end (echte Hard-Filter-/Scoring-Logik, nur DB gemockt)', () => {
  beforeEach(() => {
    queryMock.mockReset()
    trackEventsBatchMock.mockReset()
    trackEventsBatchMock.mockResolvedValue(undefined)
    createMatchNotificationsForProviderMock.mockReset()
    createMatchNotificationsForProviderMock.mockResolvedValue({ createdCount: 0, createdIds: [] })
    sendMatchNotificationEmailsMock.mockReset()
    sendMatchNotificationEmailsMock.mockResolvedValue([])
  })

  it('bevor das Gewerk gesperrt ist: der Job ist eligible und wird als aktueller Match (excluded=false) geschrieben', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [providerRow([])] }) // fetchProviderAndCandidateJobs: Provider
      .mockResolvedValueOnce({ rows: [jobRow] }) // fetchProviderAndCandidateJobs: Kandidaten-Jobs
      .mockResolvedValueOnce({ rows: [] }) // getLineItemGewerkeForJobs
      .mockResolvedValueOnce({ rows: [] }) // getMatchScoreMetricsForProviders: reviews
      .mockResolvedValueOnce({ rows: [] }) // offers
      .mockResolvedValueOnce({ rows: [] }) // wonJobs
      .mockResolvedValueOnce({ rows: [] }) // getResponseTimeStatsBatch
      .mockResolvedValueOnce({ rows: [] }) // UPSERT job_matches

    await matchProviderAgainstOpenJobs(PROVIDER_ID)

    const upsertCall = queryMock.mock.calls.find(([sql]) => typeof sql === 'string' && sql.includes('INSERT INTO job_matches'))
    expect(upsertCall).toBeDefined()
    const [, params] = upsertCall!
    // Reihenfolge pro Zeile: job_id, provider_id, match_score, matched_factors, missing_data, excluded, exclusion_reason
    expect(params[0]).toBe(JOB_ID)
    expect(params[5]).toBe(false) // excluded=false
    expect(params[6]).toBeNull() // exclusion_reason=null
  })

  it('nach dem Sperren des Gewerks: derselbe, zuvor gematchte Job bleibt in der Kandidatenmenge (Union-Invalidierung), wird aber jetzt als excluded=true mit exclusion_reason=blocked_gewerk zurückgeschrieben', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [providerRow(['Trockenbau'])] }) // Provider: Gewerk jetzt gesperrt
      // Kandidaten-Job-Query: der Job bleibt weiterhin drin, weil gewerk = ANY(provider.gewerke)
      // weiterhin zutrifft (blocked_gewerke schränkt die SQL-Vorfilterung bewusst nicht ein –
      // siehe provider-candidate-jobs.ts) – KEINE neue Invalidierungslogik nötig.
      .mockResolvedValueOnce({ rows: [jobRow] })
      .mockResolvedValueOnce({ rows: [] }) // UPSERT job_matches (kein eligibleJobs-Zweig, da hard-filter-excluded)

    await matchProviderAgainstOpenJobs(PROVIDER_ID)

    const upsertCall = queryMock.mock.calls.find(([sql]) => typeof sql === 'string' && sql.includes('INSERT INTO job_matches'))
    expect(upsertCall).toBeDefined()
    const [, params] = upsertCall!
    expect(params).toEqual([JOB_ID, PROVIDER_ID, null, '{}', '[]', true, 'blocked_gewerk'])
  })

  it('keine doppelten Notifications: createMatchNotificationsForProvider (ON CONFLICT DO NOTHING) wird bei einem Re-Lauf ohne neue Treffer nicht zu einem erneuten E-Mail-Versand führen', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [providerRow(['Trockenbau'])] })
      .mockResolvedValueOnce({ rows: [jobRow] })
      .mockResolvedValueOnce({ rows: [] })

    await matchProviderAgainstOpenJobs(PROVIDER_ID)

    expect(createMatchNotificationsForProviderMock).toHaveBeenCalledWith(PROVIDER_ID)
    expect(sendMatchNotificationEmailsMock).not.toHaveBeenCalled()
  })
})
