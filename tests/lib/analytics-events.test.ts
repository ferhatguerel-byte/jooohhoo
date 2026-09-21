import { describe, it, expect, vi, beforeEach } from 'vitest'

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }))
vi.mock('@/lib/db', () => ({ getDb: () => ({ query: queryMock }) }))

import { trackEvent, trackEventsBatch } from '@/lib/analytics-events'

describe('trackEvent()/trackEventsBatch() — Phase 3.6G First-Party-Analytics', () => {
  beforeEach(() => {
    queryMock.mockReset()
    queryMock.mockResolvedValue({ rows: [] })
  })

  it('1./2. speichert ein Event mit korrektem event_type', async () => {
    await trackEvent({ event: 'job_viewed', jobId: 'job-1' })
    const [sql, params] = queryMock.mock.calls[0]
    expect(sql).toContain('INSERT INTO analytics_events')
    expect(params[0]).toBe('job_viewed')
  })

  it('3. job_id wird korrekt gespeichert', async () => {
    await trackEvent({ event: 'job_viewed', jobId: 'job-42' })
    const [, params] = queryMock.mock.calls[0]
    expect(params[2]).toBe('job-42')
  })

  it('4. provider_id wird korrekt gespeichert', async () => {
    await trackEvent({ event: 'job_viewed', providerId: 'provider-42' })
    const [, params] = queryMock.mock.calls[0]
    expect(params[3]).toBe('provider-42')
  })

  it('5. actor_user_id wird korrekt gespeichert', async () => {
    await trackEvent({ event: 'job_viewed', actorUserId: 'user-42' })
    const [, params] = queryMock.mock.calls[0]
    expect(params[1]).toBe('user-42')
  })

  it('6. notification_id wird korrekt gespeichert', async () => {
    await trackEvent({ event: 'match_email_sent', notificationId: 'notif-42' })
    const [, params] = queryMock.mock.calls[0]
    expect(params[4]).toBe('notif-42')
  })

  it('7. metadata wird korrekt als JSON gespeichert', async () => {
    await trackEvent({ event: 'project_created', metadata: { gewerk: 'Elektro', hasBudget: true } })
    const [, params] = queryMock.mock.calls[0]
    expect(JSON.parse(params[5] as string)).toEqual({ gewerk: 'Elektro', hasBudget: true })
  })

  it('fehlende metadata wird als leeres Objekt gespeichert (NOT NULL DEFAULT)', async () => {
    await trackEvent({ event: 'job_viewed' })
    const [, params] = queryMock.mock.calls[0]
    expect(JSON.parse(params[5] as string)).toEqual({})
  })

  it('nutzt parametrisierte Platzhalter, keine SQL-String-Interpolation', async () => {
    const malicious = "'; DROP TABLE analytics_events; --"
    await trackEvent({ event: 'job_viewed', jobId: malicious })
    const [sql, params] = queryMock.mock.calls[0]
    expect(sql).not.toContain('DROP TABLE')
    expect(sql).not.toContain(malicious)
    expect(params).toContain(malicious)
  })

  it('nutzt ON CONFLICT (idempotency_key) DO NOTHING', async () => {
    await trackEvent({ event: 'project_created', idempotencyKey: 'project_created:job-1' })
    const [sql] = queryMock.mock.calls[0]
    expect(sql).toContain('ON CONFLICT (idempotency_key) DO NOTHING')
  })

  it('8. ein DB-Fehler bricht trackEvent nicht (best-effort, wirft nie)', async () => {
    queryMock.mockRejectedValue(new Error('DB down'))
    await expect(trackEvent({ event: 'job_viewed' })).resolves.toBeUndefined()
  })

  it('8b. auch trackEventsBatch wirft nie bei einem DB-Fehler', async () => {
    queryMock.mockRejectedValue(new Error('DB down'))
    await expect(trackEventsBatch([{ event: 'job_viewed' }, { event: 'job_viewed' }])).resolves.toBeUndefined()
  })

  it('9./18. Idempotency erzwingt keine künstliche Einmaligkeit, wenn kein idempotencyKey übergeben wird (JOB_VIEWED darf mehrfach vorkommen)', async () => {
    await trackEvent({ event: 'job_viewed', jobId: 'job-1' })
    await trackEvent({ event: 'job_viewed', jobId: 'job-1' })
    expect(queryMock).toHaveBeenCalledTimes(2)
    for (const call of queryMock.mock.calls) {
      const [, params] = call
      expect(params[params.length - 1]).toBeNull() // idempotency_key
    }
  })

  it('22. keine PII in metadata (Vertragstest: das aufrufende Feature darf keine E-Mail/Namen übergeben) – trackEvent selbst validiert nicht inhaltlich, sondern übernimmt exakt, was übergeben wird', async () => {
    // Dokumentiert bewusst: trackEvent() ist eine generische Persistenzschicht ohne
    // Content-Filter – die Verantwortung, keine PII zu übergeben, liegt bei den Aufrufstellen
    // (siehe deren jeweilige Kommentare/Tests, z.B. run-matching.ts, jobs/route.ts).
    await trackEvent({ event: 'project_created', metadata: { gewerk: 'Elektro' } })
    const [, params] = queryMock.mock.calls[0]
    const metadata = JSON.parse(params[5] as string)
    expect(Object.keys(metadata)).not.toContain('email')
    expect(Object.keys(metadata)).not.toContain('name')
  })

  it('23. trackEventsBatch schreibt mehrere Events in EINEM einzigen INSERT (keine N+1)', async () => {
    await trackEventsBatch([
      { event: 'match_created', jobId: 'job-1', providerId: 'p1' },
      { event: 'match_created', jobId: 'job-1', providerId: 'p2' },
      { event: 'match_created', jobId: 'job-1', providerId: 'p3' },
    ])
    expect(queryMock).toHaveBeenCalledTimes(1)
    const [sql, params] = queryMock.mock.calls[0]
    expect((sql.match(/\(\$/g) || []).length).toBe(3) // 3 Werte-Tupel im VALUES-Teil
    expect(params).toHaveLength(21) // 3 Events x 7 Spalten
  })

  it('trackEventsBatch mit leerem Array führt keine Query aus', async () => {
    await trackEventsBatch([])
    expect(queryMock).not.toHaveBeenCalled()
  })

  it('trackEvent(einzeln) delegiert an trackEventsBatch (identisches SQL-Muster)', async () => {
    await trackEvent({ event: 'job_viewed' })
    const [sql] = queryMock.mock.calls[0]
    expect(sql).toContain('VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)')
  })
})
