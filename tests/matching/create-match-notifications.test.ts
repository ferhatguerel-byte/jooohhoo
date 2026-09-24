import { describe, it, expect, vi, beforeEach } from 'vitest'

const { queryMock, trackEventsBatchMock } = vi.hoisted(() => ({ queryMock: vi.fn(), trackEventsBatchMock: vi.fn() }))
vi.mock('@/lib/db', () => ({ getDb: () => ({ query: queryMock }) }))
vi.mock('@/lib/analytics-events', () => ({ trackEventsBatch: trackEventsBatchMock }))

import { createMatchNotifications, createMatchNotificationsForProvider } from '@/lib/matching/create-match-notifications'
import { MATCH_NOTIFICATION_THRESHOLD } from '@/lib/matching/score-config'

describe('createMatchNotifications — Phase 3.6C (SQL-Struktur, gemockte DB)', () => {
  beforeEach(() => {
    queryMock.mockReset()
    queryMock.mockResolvedValue({ rows: [] })
    trackEventsBatchMock.mockReset()
    trackEventsBatchMock.mockResolvedValue(undefined)
  })

  it('führt genau eine parametrisierte Query aus (keine N+1)', async () => {
    await createMatchNotifications('job-1')
    expect(queryMock).toHaveBeenCalledTimes(1)
  })

  it('SQL selektiert exakt die drei Eligibility-Bedingungen aus der Vorgabe', async () => {
    await createMatchNotifications('job-1')
    const [sql] = queryMock.mock.calls[0]
    expect(sql).toContain('FROM job_matches')
    expect(sql).toContain('excluded = false')
    expect(sql).toContain('match_score IS NOT NULL')
    expect(sql).toContain('match_score >= $2')
  })

  it('nutzt den zentralen MATCH_NOTIFICATION_THRESHOLD als Parameter, keine hartkodierte Zahl', async () => {
    await createMatchNotifications('job-1')
    const [, params] = queryMock.mock.calls[0]
    expect(params).toEqual(['job-1', MATCH_NOTIFICATION_THRESHOLD])
    expect(MATCH_NOTIFICATION_THRESHOLD).toBe(70)
  })

  it('nutzt ON CONFLICT (job_id, provider_id) DO NOTHING – kein DO UPDATE (Snapshot bleibt unangetastet)', async () => {
    await createMatchNotifications('job-1')
    const [sql] = queryMock.mock.calls[0]
    expect(sql).toContain('ON CONFLICT (job_id, provider_id) DO NOTHING')
    expect(sql).not.toContain('DO UPDATE')
  })

  it('INSERT ... SELECT übernimmt job_match_id (job_matches.id) und match_score als Snapshot', async () => {
    await createMatchNotifications('job-1')
    const [sql] = queryMock.mock.calls[0]
    expect(sql).toContain('INSERT INTO match_notifications (job_id, provider_id, job_match_id, match_score)')
    expect(sql).toContain('SELECT job_id, provider_id, id, match_score')
  })

  it('createdCount/createdIds entsprechen den tatsächlich eingefügten Zeilen (RETURNING id)', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: 'n1' }, { id: 'n2' }] })
    const result = await createMatchNotifications('job-1')
    expect(result).toEqual({ createdCount: 2, createdIds: ['n1', 'n2'] })
  })

  it('createdCount ist 0 und createdIds leer, wenn ON CONFLICT alle Zeilen übersprungen hat (reiner Re-Run)', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] })
    const result = await createMatchNotifications('job-1')
    expect(result).toEqual({ createdCount: 0, createdIds: [] })
  })

  it('RETURNING liefert zusätzlich provider_id (für Analytics), ohne die bestehenden Felder zu verändern', async () => {
    await createMatchNotifications('job-1')
    const [sql] = queryMock.mock.calls[0]
    expect(sql).toContain('RETURNING id, provider_id')
  })
})

describe('createMatchNotifications — Phase 3.6G MATCH_NOTIFICATION_CREATED Analytics', () => {
  beforeEach(() => {
    queryMock.mockReset()
    trackEventsBatchMock.mockReset()
    trackEventsBatchMock.mockResolvedValue(undefined)
  })

  it('trackt MATCH_NOTIFICATION_CREATED NUR für tatsächlich neu erzeugte Zeilen, mit Threshold aus der zentralen Konfiguration', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: 'n1', provider_id: 'p1' }, { id: 'n2', provider_id: 'p2' }] })
    await createMatchNotifications('job-1')
    expect(trackEventsBatchMock).toHaveBeenCalledTimes(1)
    expect(trackEventsBatchMock).toHaveBeenCalledWith([
      expect.objectContaining({
        event: 'match_notification_created',
        jobId: 'job-1',
        providerId: 'p1',
        notificationId: 'n1',
        metadata: { threshold: MATCH_NOTIFICATION_THRESHOLD },
        idempotencyKey: 'match_notification_created:n1',
      }),
      expect.objectContaining({
        event: 'match_notification_created',
        jobId: 'job-1',
        providerId: 'p2',
        notificationId: 'n2',
        metadata: { threshold: MATCH_NOTIFICATION_THRESHOLD },
        idempotencyKey: 'match_notification_created:n2',
      }),
    ])
  })

  it('reiner Re-Run ohne neue Zeilen (ON CONFLICT DO NOTHING): kein Analytics-Aufruf', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] })
    await createMatchNotifications('job-1')
    expect(trackEventsBatchMock).not.toHaveBeenCalled()
  })

  it('keine matched_factors/missing_data/exclusion_reason in den Analytics-Metadaten', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: 'n1', provider_id: 'p1' }] })
    await createMatchNotifications('job-1')
    const [events] = trackEventsBatchMock.mock.calls[0]
    expect(events[0].metadata).toEqual({ threshold: MATCH_NOTIFICATION_THRESHOLD })
  })

  it('ein Fehler beim Analytics-Tracking lässt createMatchNotifications trotzdem erfolgreich zurückkehren', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: 'n1', provider_id: 'p1' }] })
    trackEventsBatchMock.mockRejectedValue(new Error('Analytics-DB down'))
    const result = await createMatchNotifications('job-1')
    expect(result).toEqual({ createdCount: 1, createdIds: ['n1'] })
  })
})

describe('createMatchNotificationsForProvider — Matching-Lifecycle Provider-zentriertes Gegenstück', () => {
  beforeEach(() => {
    queryMock.mockReset()
    queryMock.mockResolvedValue({ rows: [] })
    trackEventsBatchMock.mockReset()
    trackEventsBatchMock.mockResolvedValue(undefined)
  })

  it('führt genau eine parametrisierte Query mit provider_id = $1 aus (keine N+1)', async () => {
    await createMatchNotificationsForProvider('p1')
    expect(queryMock).toHaveBeenCalledTimes(1)
    const [sql, params] = queryMock.mock.calls[0]
    expect(sql).toContain('WHERE provider_id = $1')
    expect(sql).toContain('excluded = false')
    expect(sql).toContain('match_score IS NOT NULL')
    expect(params).toEqual(['p1', MATCH_NOTIFICATION_THRESHOLD])
  })

  it('nutzt dieselbe ON CONFLICT DO NOTHING-Idempotenzgarantie wie die job-zentrierte Variante', async () => {
    await createMatchNotificationsForProvider('p1')
    const [sql] = queryMock.mock.calls[0]
    expect(sql).toContain('ON CONFLICT (job_id, provider_id) DO NOTHING')
  })

  it('createdCount/createdIds entsprechen den tatsächlich eingefügten Zeilen', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: 'n1', job_id: 'job-1' }] })
    const result = await createMatchNotificationsForProvider('p1')
    expect(result).toEqual({ createdCount: 1, createdIds: ['n1'] })
  })

  it('reiner Re-Run ohne neue Treffer (ON CONFLICT DO NOTHING übersprungen): kein Analytics-Aufruf, keine doppelte Notification', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] })
    const result = await createMatchNotificationsForProvider('p1')
    expect(result).toEqual({ createdCount: 0, createdIds: [] })
    expect(trackEventsBatchMock).not.toHaveBeenCalled()
  })

  it('trackt MATCH_NOTIFICATION_CREATED für neu erzeugte Zeilen mit der festen providerId und der jeweiligen job_id', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: 'n1', job_id: 'job-1' }] })
    await createMatchNotificationsForProvider('p1')
    expect(trackEventsBatchMock).toHaveBeenCalledWith([
      expect.objectContaining({
        event: 'match_notification_created',
        jobId: 'job-1',
        providerId: 'p1',
        notificationId: 'n1',
        idempotencyKey: 'match_notification_created:n1',
      }),
    ])
  })
})
