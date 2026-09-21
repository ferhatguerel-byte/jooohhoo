import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ScoredProviderResult } from '@/lib/matching/scored-providers'

const { getScoredProvidersForJobMock, connectMock, clientQueryMock, releaseMock, createMatchNotificationsMock } = vi.hoisted(() => ({
  getScoredProvidersForJobMock: vi.fn(),
  connectMock: vi.fn(),
  clientQueryMock: vi.fn(),
  releaseMock: vi.fn(),
  createMatchNotificationsMock: vi.fn(),
}))
vi.mock('@/lib/matching/scored-providers', () => ({ getScoredProvidersForJob: getScoredProvidersForJobMock }))
vi.mock('@/lib/matching/create-match-notifications', () => ({ createMatchNotifications: createMatchNotificationsMock }))
vi.mock('@/lib/db', () => ({ getDb: () => ({ connect: connectMock }) }))

import { runMatchingForJob } from '@/lib/matching/run-matching'

function eligibleResult(providerId: string, score = 80): ScoredProviderResult {
  return {
    providerId,
    eligible: true,
    score: { score, breakdown: { serviceFit: 30, distance: 20, verification: 15, projectSize: 0, experience: 0, rating: 0, responseTime: 0 }, missingData: ['Keine Bewertungen vorhanden.'] },
  }
}

function excludedResult(providerId: string, reason: ScoredProviderResult['exclusionReason'] = 'gewerk_mismatch'): ScoredProviderResult {
  return { providerId, eligible: false, exclusionReason: reason }
}

/** Sucht in den client.query-Aufrufen den mit dem übergebenen SQL-Fragment. */
function findCall(fragment: string) {
  return clientQueryMock.mock.calls.find(([sql]) => typeof sql === 'string' && sql.includes(fragment))
}

describe('runMatchingForJob — Phase 3.5 Match Storage', () => {
  beforeEach(() => {
    getScoredProvidersForJobMock.mockReset()
    connectMock.mockReset()
    clientQueryMock.mockReset()
    releaseMock.mockReset()
    createMatchNotificationsMock.mockReset()
    connectMock.mockResolvedValue({ query: clientQueryMock, release: releaseMock })
    clientQueryMock.mockResolvedValue({ rows: [] })
    // Notification-Erstellung ist ab Phase 3.6C Teil der Pipeline, wird hier aber isoliert
    // gemockt – ihr Verhalten wird in tests/matching/create-match-notifications.test.ts geprüft.
    createMatchNotificationsMock.mockResolvedValue({ createdCount: 0 })
  })

  it('1. erster Matching-Lauf: mehrere geeignete Provider werden als Datensätze geschrieben', async () => {
    getScoredProvidersForJobMock.mockResolvedValue([eligibleResult('p1', 90), eligibleResult('p2', 60)])
    const result = await runMatchingForJob('job-1')
    expect(result).toEqual({ jobId: 'job-1', resultCount: 2, eligibleCount: 2, excludedCount: 0 })
    const insertCall = findCall('INSERT INTO job_matches')
    expect(insertCall).toBeDefined()
    const [, params] = insertCall!
    expect(params).toContain(90)
    expect(params).toContain(60)
  })

  it('2. wiederholter Lauf: SQL nutzt ON CONFLICT DO UPDATE (kein zweiter INSERT-Pfad, keine Duplikate möglich)', async () => {
    getScoredProvidersForJobMock.mockResolvedValue([eligibleResult('p1', 90)])
    await runMatchingForJob('job-1')
    await runMatchingForJob('job-1')
    const insertCalls = clientQueryMock.mock.calls.filter(([sql]) => typeof sql === 'string' && sql.includes('INSERT INTO job_matches'))
    expect(insertCalls).toHaveLength(2)
    for (const [sql] of insertCalls) {
      expect(sql).toContain('ON CONFLICT (job_id, provider_id) DO UPDATE')
    }
  })

  it('3. Score-Änderung: zweiter Lauf mit geändertem Provider-Score persistiert den neuen Wert', async () => {
    getScoredProvidersForJobMock.mockResolvedValueOnce([eligibleResult('p1', 40)])
    await runMatchingForJob('job-1')
    getScoredProvidersForJobMock.mockResolvedValueOnce([eligibleResult('p1', 95)])
    await runMatchingForJob('job-1')

    const insertCalls = clientQueryMock.mock.calls.filter(([sql]) => typeof sql === 'string' && sql.includes('INSERT INTO job_matches'))
    const [, secondParams] = insertCalls[1]
    expect(secondParams).toContain(95)
    expect(secondParams).not.toContain(40)
  })

  it('4. neuer Provider: taucht beim nächsten Lauf zusätzlich im INSERT auf', async () => {
    getScoredProvidersForJobMock.mockResolvedValueOnce([eligibleResult('p1', 70)])
    await runMatchingForJob('job-1')
    getScoredProvidersForJobMock.mockResolvedValueOnce([eligibleResult('p1', 70), eligibleResult('p2', 55)])
    await runMatchingForJob('job-1')

    const insertCalls = clientQueryMock.mock.calls.filter(([sql]) => typeof sql === 'string' && sql.includes('INSERT INTO job_matches'))
    const [, secondParams] = insertCalls[1]
    expect(secondParams).toContain('p1')
    expect(secondParams).toContain('p2')
  })

  it('5. Provider fällt aus Hard Filter: er ist beim nächsten Lauf nicht mehr in den aktuellen Kandidaten enthalten', async () => {
    getScoredProvidersForJobMock.mockResolvedValueOnce([eligibleResult('p1', 70), eligibleResult('p2', 55)])
    await runMatchingForJob('job-1')
    // p2 erreicht beim zweiten Lauf die SQL-Vorfilterung nicht mehr (z.B. Abo gekündigt) -> gar
    // nicht mehr im Ergebnis von getScoredProvidersForJob.
    getScoredProvidersForJobMock.mockResolvedValueOnce([eligibleResult('p1', 70)])
    await runMatchingForJob('job-1')

    const deleteCalls = clientQueryMock.mock.calls.filter(([sql]) => typeof sql === 'string' && sql.includes('DELETE FROM job_matches'))
    const [, secondDeleteParams] = deleteCalls[1]
    // Der DELETE-Parameter (aktuelle Kandidaten-IDs) enthält p2 nicht mehr -> die SQL-Bedingung
    // "provider_id != ALL($2)" entfernt seinen alten Match (siehe echte-DB-Verifikation im Bericht).
    expect(secondDeleteParams[1]).toEqual(['p1'])
  })

  it('6. Provider wird wieder eligible: nächster Lauf erzeugt wieder einen aktuellen Match', async () => {
    getScoredProvidersForJobMock.mockResolvedValueOnce([excludedResult('p1', 'blocked_gewerk')])
    await runMatchingForJob('job-1')
    getScoredProvidersForJobMock.mockResolvedValueOnce([eligibleResult('p1', 65)])
    await runMatchingForJob('job-1')

    const insertCalls = clientQueryMock.mock.calls.filter(([sql]) => typeof sql === 'string' && sql.includes('INSERT INTO job_matches'))
    const [, secondParams] = insertCalls[1]
    expect(secondParams).toContain(65)
    expect(secondParams).toContain(false) // excluded=false im zweiten Lauf
  })

  it('7. ausgeschlossener Provider: excluded=true, match_score=NULL, exclusion_reason korrekt gesetzt', async () => {
    getScoredProvidersForJobMock.mockResolvedValue([excludedResult('p1', 'missing_master_qualification')])
    await runMatchingForJob('job-1')
    const [, params] = findCall('INSERT INTO job_matches')!
    // Reihenfolge je Zeile: job_id, provider_id, match_score, matched_factors, missing_data, excluded, exclusion_reason
    expect(params).toEqual(['job-1', 'p1', null, '{}', '[]', true, 'missing_master_qualification'])
  })

  it('8. geeigneter Provider: excluded=false, match_score zwischen 0 und 100, exclusion_reason=NULL', async () => {
    getScoredProvidersForJobMock.mockResolvedValue([eligibleResult('p1', 77)])
    await runMatchingForJob('job-1')
    const [, params] = findCall('INSERT INTO job_matches')!
    expect(params[2]).toBe(77)
    expect(params[2]).toBeGreaterThanOrEqual(0)
    expect(params[2]).toBeLessThanOrEqual(100)
    expect(params[5]).toBe(false)
    expect(params[6]).toBeNull()
  })

  it('9. missing_data wird korrekt (als JSON-Array) gespeichert und enthält keine personenbezogenen Daten', async () => {
    getScoredProvidersForJobMock.mockResolvedValue([eligibleResult('p1', 50)])
    await runMatchingForJob('job-1')
    const [, params] = findCall('INSERT INTO job_matches')!
    const missingData = JSON.parse(params[4] as string)
    expect(missingData).toEqual(['Keine Bewertungen vorhanden.'])
    expect(missingData.join(' ')).not.toMatch(/@|Straße|Tel\.|\+49/)
  })

  it('10. matched_factors (Score-Breakdown) wird korrekt gespeichert', async () => {
    getScoredProvidersForJobMock.mockResolvedValue([eligibleResult('p1', 65)])
    await runMatchingForJob('job-1')
    const [, params] = findCall('INSERT INTO job_matches')!
    const matchedFactors = JSON.parse(params[3] as string)
    expect(matchedFactors).toEqual({ serviceFit: 30, distance: 20, verification: 15, projectSize: 0, experience: 0, rating: 0, responseTime: 0 })
  })

  it('11. 0 Matches: Matching läuft erfolgreich durch, kein Fehler, kein Fake-Datensatz', async () => {
    getScoredProvidersForJobMock.mockResolvedValue([])
    const result = await runMatchingForJob('job-1')
    expect(result).toEqual({ jobId: 'job-1', resultCount: 0, eligibleCount: 0, excludedCount: 0 })
    expect(findCall('INSERT INTO job_matches')).toBeUndefined()
    // DELETE läuft trotzdem, um evtl. vorherige (jetzt veraltete) Matches zu entfernen.
    expect(findCall('DELETE FROM job_matches')).toBeDefined()
  })

  it('12. Unique Constraint: die SQL nutzt ON CONFLICT (job_id, provider_id) als einzigen Schreibpfad', async () => {
    getScoredProvidersForJobMock.mockResolvedValue([eligibleResult('p1', 50)])
    await runMatchingForJob('job-1')
    const [sql] = findCall('INSERT INTO job_matches')!
    expect(sql).toContain('ON CONFLICT (job_id, provider_id) DO UPDATE')
  })

  it('13. Score Constraint: der persistierte Score entspricht exakt dem von calculateProviderMatchScore gelieferten (0-100) Wert, keine Manipulation', async () => {
    getScoredProvidersForJobMock.mockResolvedValue([eligibleResult('p1', 0), eligibleResult('p2', 100)])
    await runMatchingForJob('job-1')
    const [, params] = findCall('INSERT INTO job_matches')!
    expect(params).toContain(0)
    expect(params).toContain(100)
  })

  it('14. Exclusion Consistency: excluded=true hat nie einen match_score, excluded=false hat nie einen exclusion_reason', async () => {
    getScoredProvidersForJobMock.mockResolvedValue([eligibleResult('p1', 50), excludedResult('p2', 'account_inactive')])
    await runMatchingForJob('job-1')
    const [, params] = findCall('INSERT INTO job_matches')!
    // Zeile 1 (p1): match_score=50, excluded=false, exclusion_reason=null
    expect(params.slice(0, 7)).toEqual(['job-1', 'p1', 50, expect.any(String), expect.any(String), false, null])
    // Zeile 2 (p2): match_score=null, excluded=true, exclusion_reason gesetzt
    expect(params.slice(7, 14)).toEqual(['job-1', 'p2', null, '{}', '[]', true, 'account_inactive'])
  })

  it('15. veraltete Matches: DELETE-Query schließt gezielt alle nicht mehr aktuellen provider_id aus', async () => {
    getScoredProvidersForJobMock.mockResolvedValue([eligibleResult('p1', 50), eligibleResult('p2', 60)])
    await runMatchingForJob('job-1')
    const [sql, params] = findCall('DELETE FROM job_matches')!
    expect(sql).toContain('provider_id != ALL($2::uuid[])')
    expect(params).toEqual(['job-1', ['p1', 'p2']])
  })

  it('16. Transaktions-Rollback: Fehler während der Persistierung hinterlässt keine teilweise gespeicherte Menge', async () => {
    getScoredProvidersForJobMock.mockResolvedValue([eligibleResult('p1', 50)])
    clientQueryMock.mockImplementation((sql: string) => {
      if (sql.includes('INSERT INTO job_matches')) throw new Error('DB-Fehler beim Schreiben')
      return Promise.resolve({ rows: [] })
    })
    await expect(runMatchingForJob('job-1')).rejects.toThrow('DB-Fehler beim Schreiben')
    expect(findCall('ROLLBACK')).toBeDefined()
    expect(findCall('COMMIT')).toBeUndefined()
    expect(releaseMock).toHaveBeenCalled()
  })

  it('17. keine N+1 Inserts: mehrere Provider erzeugen genau einen INSERT- und einen DELETE-Aufruf, keinen pro Provider', async () => {
    getScoredProvidersForJobMock.mockResolvedValue([
      eligibleResult('p1', 10),
      eligibleResult('p2', 20),
      eligibleResult('p3', 30),
      excludedResult('p4', 'out_of_radius'),
      excludedResult('p5', 'project_size_mismatch'),
    ])
    await runMatchingForJob('job-1')
    const writeCalls = clientQueryMock.mock.calls.filter(
      ([sql]) => typeof sql === 'string' && (sql.includes('INSERT INTO job_matches') || sql.includes('DELETE FROM job_matches'))
    )
    expect(writeCalls).toHaveLength(2) // genau 1 Bulk-INSERT + 1 DELETE, unabhängig von 5 Providern
  })

  it('18. (Phase 3.6C) ruft createMatchNotifications mit der jobId auf, NACHDEM der Matching-Commit erfolgt ist', async () => {
    getScoredProvidersForJobMock.mockResolvedValue([eligibleResult('p1', 90)])
    await runMatchingForJob('job-1')
    expect(createMatchNotificationsMock).toHaveBeenCalledWith('job-1')
    const commitCallIndex = clientQueryMock.mock.calls.findIndex(([sql]) => sql === 'COMMIT')
    const commitInvocationOrder = clientQueryMock.mock.invocationCallOrder[commitCallIndex]
    const notificationInvocationOrder = createMatchNotificationsMock.mock.invocationCallOrder[0]
    expect(notificationInvocationOrder).toBeGreaterThan(commitInvocationOrder)
  })

  it('19. (Phase 3.6C) ein Fehler in createMatchNotifications lässt runMatchingForJob trotzdem erfolgreich zurückkehren (isoliert, geloggt)', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    getScoredProvidersForJobMock.mockResolvedValue([eligibleResult('p1', 90)])
    createMatchNotificationsMock.mockRejectedValue(new Error('Notification-DB-Fehler'))

    const result = await runMatchingForJob('job-1')

    expect(result).toEqual({ jobId: 'job-1', resultCount: 1, eligibleCount: 1, excludedCount: 0 })
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Notification'), 'job-1', expect.any(Error))
    consoleErrorSpy.mockRestore()
  })
})
