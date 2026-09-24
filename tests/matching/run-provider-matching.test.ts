import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ScoredJobResult } from '@/lib/matching/scored-jobs'

const { getScoredJobsForProviderMock, queryMock, createMatchNotificationsForProviderMock, sendMatchNotificationEmailsMock, trackEventsBatchMock } =
  vi.hoisted(() => ({
    getScoredJobsForProviderMock: vi.fn(),
    queryMock: vi.fn(),
    createMatchNotificationsForProviderMock: vi.fn(),
    sendMatchNotificationEmailsMock: vi.fn(),
    trackEventsBatchMock: vi.fn(),
  }))
vi.mock('@/lib/matching/scored-jobs', () => ({ getScoredJobsForProvider: getScoredJobsForProviderMock }))
vi.mock('@/lib/matching/create-match-notifications', () => ({ createMatchNotificationsForProvider: createMatchNotificationsForProviderMock }))
vi.mock('@/lib/matching/send-match-notification-emails', () => ({ sendMatchNotificationEmails: sendMatchNotificationEmailsMock }))
vi.mock('@/lib/db', () => ({ getDb: () => ({ query: queryMock }) }))
vi.mock('@/lib/analytics-events', () => ({ trackEventsBatch: trackEventsBatchMock }))

import { matchProviderAgainstOpenJobs } from '@/lib/matching/run-provider-matching'

function eligibleResult(jobId: string, score = 80): ScoredJobResult {
  return {
    jobId,
    eligible: true,
    score: { score, breakdown: { serviceFit: 30, distance: 20, verification: 15, projectSize: 0, experience: 0, rating: 0, responseTime: 0 }, missingData: [] },
  }
}

function excludedResult(jobId: string, reason: ScoredJobResult['exclusionReason'] = 'gewerk_mismatch'): ScoredJobResult {
  return { jobId, eligible: false, exclusionReason: reason }
}

describe('matchProviderAgainstOpenJobs — Matching-Lifecycle Provider-zentrierte Persistierung', () => {
  beforeEach(() => {
    getScoredJobsForProviderMock.mockReset()
    queryMock.mockReset()
    queryMock.mockResolvedValue({ rows: [] })
    createMatchNotificationsForProviderMock.mockReset()
    createMatchNotificationsForProviderMock.mockResolvedValue({ createdCount: 0, createdIds: [] })
    sendMatchNotificationEmailsMock.mockReset()
    sendMatchNotificationEmailsMock.mockResolvedValue([])
    trackEventsBatchMock.mockReset()
    trackEventsBatchMock.mockResolvedValue(undefined)
  })

  it('schreibt ein Bulk-UPSERT für alle Job-Ergebnisse eines Providers', async () => {
    getScoredJobsForProviderMock.mockResolvedValue([eligibleResult('job-1', 90), eligibleResult('job-2', 60)])
    const result = await matchProviderAgainstOpenJobs('p1')
    expect(result).toEqual({ providerId: 'p1', resultCount: 2, eligibleCount: 2, excludedCount: 0 })
    const [sql, params] = queryMock.mock.calls[0]
    expect(sql).toContain('ON CONFLICT (job_id, provider_id) DO UPDATE')
    expect(params).toContain('job-1')
    expect(params).toContain('job-2')
    expect(params).toContain('p1')
  })

  it('0 Kandidaten-Jobs: kein UPSERT, kein Fehler', async () => {
    getScoredJobsForProviderMock.mockResolvedValue([])
    const result = await matchProviderAgainstOpenJobs('p1')
    expect(result).toEqual({ providerId: 'p1', resultCount: 0, eligibleCount: 0, excludedCount: 0 })
    expect(queryMock).not.toHaveBeenCalled()
  })

  it('idempotenter Re-Run: zweiter Lauf mit unverändertem Ergebnis überschreibt denselben Snapshot (ON CONFLICT DO UPDATE, kein zweiter Schreibpfad)', async () => {
    getScoredJobsForProviderMock.mockResolvedValue([eligibleResult('job-1', 80)])
    await matchProviderAgainstOpenJobs('p1')
    await matchProviderAgainstOpenJobs('p1')
    expect(queryMock).toHaveBeenCalledTimes(2)
    for (const [sql] of queryMock.mock.calls) {
      expect(sql).toContain('ON CONFLICT (job_id, provider_id) DO UPDATE')
    }
  })

  it('Profiländerung entfernt einen bisherigen Hard-Filter-Match: nächster Lauf schreibt excluded=true für diesen Job', async () => {
    getScoredJobsForProviderMock.mockResolvedValueOnce([eligibleResult('job-1', 80)])
    await matchProviderAgainstOpenJobs('p1')
    getScoredJobsForProviderMock.mockResolvedValueOnce([excludedResult('job-1', 'gewerk_mismatch')])
    await matchProviderAgainstOpenJobs('p1')
    const [, secondParams] = queryMock.mock.calls[1]
    // Reihenfolge pro Zeile: job_id, provider_id, match_score, matched_factors, missing_data, excluded, exclusion_reason
    expect(secondParams).toEqual(['job-1', 'p1', null, '{}', '[]', true, 'gewerk_mismatch'])
  })

  it('erzeugt genau ein MATCH_CREATED-Event pro eligiblem Job, keins für ausgeschlossene', async () => {
    getScoredJobsForProviderMock.mockResolvedValue([eligibleResult('job-1', 90), excludedResult('job-2')])
    await matchProviderAgainstOpenJobs('p1')
    expect(trackEventsBatchMock).toHaveBeenCalledWith([
      expect.objectContaining({ event: 'match_created', jobId: 'job-1', providerId: 'p1', idempotencyKey: 'match_created:job-1:p1' }),
    ])
  })

  it('ruft createMatchNotificationsForProvider mit der providerId auf und versendet nur neu erzeugte IDs', async () => {
    getScoredJobsForProviderMock.mockResolvedValue([eligibleResult('job-1', 90)])
    createMatchNotificationsForProviderMock.mockResolvedValue({ createdCount: 1, createdIds: ['n1'] })
    await matchProviderAgainstOpenJobs('p1')
    expect(createMatchNotificationsForProviderMock).toHaveBeenCalledWith('p1')
    expect(sendMatchNotificationEmailsMock).toHaveBeenCalledWith(['n1'])
  })

  it('keine doppelten Notifications: ein Re-Lauf ohne neue Treffer löst keinen erneuten E-Mail-Versand aus', async () => {
    getScoredJobsForProviderMock.mockResolvedValue([eligibleResult('job-1', 90)])
    createMatchNotificationsForProviderMock.mockResolvedValue({ createdCount: 0, createdIds: [] })
    await matchProviderAgainstOpenJobs('p1')
    expect(sendMatchNotificationEmailsMock).not.toHaveBeenCalled()
  })

  it('ein Fehler bei der Notification-Pipeline lässt den Matching-Lauf trotzdem erfolgreich zurückkehren (isoliert)', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    getScoredJobsForProviderMock.mockResolvedValue([eligibleResult('job-1', 90)])
    createMatchNotificationsForProviderMock.mockRejectedValue(new Error('DB-Fehler'))
    const result = await matchProviderAgainstOpenJobs('p1')
    expect(result).toEqual({ providerId: 'p1', resultCount: 1, eligibleCount: 1, excludedCount: 0 })
    consoleErrorSpy.mockRestore()
  })

  it('parallele/doppelte Aufrufe für denselben Provider führen jeweils zu einem eigenständigen, unabhängigen UPSERT (kein Absturz, keine geteilte Zwischenstruktur)', async () => {
    getScoredJobsForProviderMock.mockResolvedValue([eligibleResult('job-1', 50)])
    await Promise.all([matchProviderAgainstOpenJobs('p1'), matchProviderAgainstOpenJobs('p1')])
    expect(queryMock).toHaveBeenCalledTimes(2)
  })
})
