import { describe, it, expect, vi, beforeEach } from 'vitest'

const { queryMock, trackEventsBatchMock, createMatchNotificationsForProviderMock, sendMatchNotificationEmailsMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
  trackEventsBatchMock: vi.fn(),
  createMatchNotificationsForProviderMock: vi.fn(),
  sendMatchNotificationEmailsMock: vi.fn(),
}))
vi.mock('@/lib/db', () => ({ getDb: () => ({ query: queryMock }) }))
vi.mock('@/lib/analytics-events', () => ({ trackEventsBatch: trackEventsBatchMock }))
vi.mock('@/lib/matching/create-match-notifications', () => ({
  createMatchNotificationsForProvider: createMatchNotificationsForProviderMock,
}))
vi.mock('@/lib/matching/send-match-notification-emails', () => ({ sendMatchNotificationEmails: sendMatchNotificationEmailsMock }))

import { matchProviderAgainstOpenJobs } from '@/lib/matching/run-provider-matching'

const PROVIDER_ID = 'p1'
const JOB_ID = 'job-1'

const providerRow = (accountStatus: 'active' | 'suspended' | 'deleted') => ({
  id: PROVIDER_ID,
  gewerke: ['Trockenbau'],
  blocked_gewerke: [],
  verified_gewerke: [],
  account_status: accountStatus,
  subscription_status: 'active',
  plz: '10115',
  service_radius_km: null,
  min_project_size: null,
  max_project_size: null,
  verification_status: 'unverified',
})

const jobRow = { id: JOB_ID, gewerk: 'Trockenbau', plz: '10115', budget_min: null, budget_max: null }

/**
 * Admin-Unternehmensverwaltung – end-to-end (echte Hard-Filter-/Scoring-Logik, nur DB gemockt):
 * Sperren/Löschen (account_status != 'active') invalidiert einen bestehenden Match genau wie
 * eine Gewerke-Sperre (siehe tests/matching/gewerke-block-invalidation.test.ts) – dieselbe
 * matchProviderAgainstOpenJobs()-Pipeline, keine zweite Invalidierungslogik.
 */
describe('Admin-Unternehmensverwaltung – Sperren/Löschen invalidiert bestehende Matches über die bestehende Matching-Pipeline', () => {
  beforeEach(() => {
    queryMock.mockReset()
    trackEventsBatchMock.mockReset()
    trackEventsBatchMock.mockResolvedValue(undefined)
    createMatchNotificationsForProviderMock.mockReset()
    createMatchNotificationsForProviderMock.mockResolvedValue({ createdCount: 0, createdIds: [] })
    sendMatchNotificationEmailsMock.mockReset()
    sendMatchNotificationEmailsMock.mockResolvedValue([])
  })

  it('Sperrung (account_status=suspended): der zuvor gültige Match bleibt in der Kandidatenmenge (Union-Invalidierung), wird aber jetzt als excluded=true mit exclusion_reason=account_inactive zurückgeschrieben', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [providerRow('suspended')] }) // Provider jetzt gesperrt
      .mockResolvedValueOnce({ rows: [jobRow] }) // Job bleibt über bestehenden non-excluded Match in der Kandidatenmenge
      .mockResolvedValueOnce({ rows: [] }) // UPSERT job_matches

    await matchProviderAgainstOpenJobs(PROVIDER_ID)

    const upsertCall = queryMock.mock.calls.find(([sql]) => typeof sql === 'string' && sql.includes('INSERT INTO job_matches'))
    expect(upsertCall).toBeDefined()
    const [, params] = upsertCall!
    expect(params).toEqual([JOB_ID, PROVIDER_ID, null, '{}', '[]', true, 'account_inactive'])
  })

  it('Löschung (account_status=deleted): derselbe Effekt wie Sperrung – excluded=true mit exclusion_reason=account_inactive', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [providerRow('deleted')] })
      .mockResolvedValueOnce({ rows: [jobRow] })
      .mockResolvedValueOnce({ rows: [] })

    await matchProviderAgainstOpenJobs(PROVIDER_ID)

    const upsertCall = queryMock.mock.calls.find(([sql]) => typeof sql === 'string' && sql.includes('INSERT INTO job_matches'))
    const [, params] = upsertCall!
    expect(params[5]).toBe(true)
    expect(params[6]).toBe('account_inactive')
  })

  it('keine doppelten Notifications: createMatchNotificationsForProvider läuft trotzdem, erzeugt aber ohne neue Treffer keinen E-Mail-Versand', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [providerRow('suspended')] })
      .mockResolvedValueOnce({ rows: [jobRow] })
      .mockResolvedValueOnce({ rows: [] })

    await matchProviderAgainstOpenJobs(PROVIDER_ID)

    expect(createMatchNotificationsForProviderMock).toHaveBeenCalledWith(PROVIDER_ID)
    expect(sendMatchNotificationEmailsMock).not.toHaveBeenCalled()
  })
})
