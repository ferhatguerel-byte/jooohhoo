import { describe, it, expect, vi, beforeEach } from 'vitest'

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }))
vi.mock('@/lib/db', () => ({ getDb: () => ({ query: queryMock }) }))

import { createMatchNotifications } from '@/lib/matching/create-match-notifications'
import { MATCH_NOTIFICATION_THRESHOLD } from '@/lib/matching/score-config'

describe('createMatchNotifications — Phase 3.6C (SQL-Struktur, gemockte DB)', () => {
  beforeEach(() => {
    queryMock.mockReset()
    queryMock.mockResolvedValue({ rows: [] })
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
})
