import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { getCurrentUserMock, queryMock, connectMock, clientQueryMock, releaseMock, runMatchingForJobMock, trackEventMock } = vi.hoisted(() => ({
  getCurrentUserMock: vi.fn(),
  queryMock: vi.fn(),
  connectMock: vi.fn(),
  clientQueryMock: vi.fn(),
  releaseMock: vi.fn(),
  runMatchingForJobMock: vi.fn(),
  trackEventMock: vi.fn(),
}))
vi.mock('@/lib/current-user', () => ({ getCurrentUser: getCurrentUserMock }))
vi.mock('@/lib/db', () => ({ getDb: () => ({ query: queryMock, connect: connectMock }) }))
vi.mock('@/lib/matching/run-matching', () => ({ runMatchingForJob: runMatchingForJobMock }))
vi.mock('@/lib/email', () => ({ sendOfferAwardedEmail: vi.fn(), sendNewOfferEmail: vi.fn() }))
vi.mock('@/lib/analytics-events', () => ({ trackEvent: trackEventMock }))

import { POST as createJob } from '@/app/api/jobs/route'
import { PATCH as patchJob } from '@/app/api/jobs/[id]/route'
import { POST as awardJob } from '@/app/api/jobs/[id]/award/route'
import { POST as submitOffer } from '@/app/api/jobs/[id]/offers/route'

const validBody = {
  title: 'Badezimmer renovieren',
  gewerk: 'Elektro',
  plz: '10115',
  ort: 'Berlin',
  description: 'Komplettsanierung eines Badezimmers in einer Altbauwohnung.',
}

function jsonReq(url: string, body: unknown, method = 'POST') {
  return new NextRequest(url, { method, body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })
}

describe('POST /api/jobs — Phase 3.6A Match Trigger', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9)
    getCurrentUserMock.mockReset()
    queryMock.mockReset()
    connectMock.mockReset()
    clientQueryMock.mockReset()
    releaseMock.mockReset()
    runMatchingForJobMock.mockReset()
    trackEventMock.mockReset()
    trackEventMock.mockResolvedValue(undefined)

    getCurrentUserMock.mockResolvedValue({ id: 'ag-1', role: 'auftraggeber' })
    // Phase 4.3: POST /api/jobs prüft vor der eigentlichen Erstellung zwei Rate Limits
    // (pro Nutzer + pro IP) über pool.query() (= queryMock), unabhängig von der Transaktion
    // (clientQueryMock). count:0 lässt beide Prüfungen unbegrenzt oft durchlaufen.
    queryMock.mockResolvedValue({ rows: [{ count: 0 }] })
    connectMock.mockResolvedValue({ query: clientQueryMock, release: releaseMock })
    clientQueryMock.mockImplementation((sql: string) => {
      if (typeof sql === 'string' && sql.includes('INSERT INTO jobs')) {
        return Promise.resolve({ rows: [{ id: 'job-123' }] })
      }
      return Promise.resolve({ rows: [] })
    })
    runMatchingForJobMock.mockResolvedValue({ jobId: 'job-123', resultCount: 0, eligibleCount: 0, excludedCount: 0 })
  })

  it('1. ruft runMatchingForJob genau einmal auf', async () => {
    await createJob(jsonReq('http://localhost/api/jobs', validBody))
    expect(runMatchingForJobMock).toHaveBeenCalledTimes(1)
  })

  it('2. übergibt die korrekte jobId', async () => {
    await createJob(jsonReq('http://localhost/api/jobs', validBody))
    expect(runMatchingForJobMock).toHaveBeenCalledWith('job-123')
  })

  it('3. Matching läuft erst NACH dem erfolgreichen COMMIT', async () => {
    await createJob(jsonReq('http://localhost/api/jobs', validBody))
    const commitCallIndex = clientQueryMock.mock.calls.findIndex(([sql]) => sql === 'COMMIT')
    expect(commitCallIndex).toBeGreaterThanOrEqual(0)
    const commitInvocationOrder = clientQueryMock.mock.invocationCallOrder[commitCallIndex]
    const matchingInvocationOrder = runMatchingForJobMock.mock.invocationCallOrder[0]
    expect(matchingInvocationOrder).toBeGreaterThan(commitInvocationOrder)
  })

  it('4. ein Matching-Fehler verhindert NICHT die erfolgreiche Job-Erstellung', async () => {
    runMatchingForJobMock.mockRejectedValue(new Error('Matching-Pipeline down'))
    const res = await createJob(jsonReq('http://localhost/api/jobs', validBody))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({ ok: true, id: 'job-123' })
  })

  it('5. ein Matching-Fehler wird serverseitig geloggt', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    runMatchingForJobMock.mockRejectedValue(new Error('Matching-Pipeline down'))
    await createJob(jsonReq('http://localhost/api/jobs', validBody))
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Matching'),
      'job-123',
      expect.any(Error)
    )
    consoleErrorSpy.mockRestore()
  })
})

describe('POST /api/jobs — Phase 3.6G PROJECT_CREATED Analytics', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9)
    getCurrentUserMock.mockReset()
    queryMock.mockReset()
    connectMock.mockReset()
    clientQueryMock.mockReset()
    releaseMock.mockReset()
    runMatchingForJobMock.mockReset()
    trackEventMock.mockReset()
    trackEventMock.mockResolvedValue(undefined)

    getCurrentUserMock.mockResolvedValue({ id: 'ag-1', role: 'auftraggeber' })
    // Phase 4.3: siehe Kommentar im ersten describe-Block oben.
    queryMock.mockResolvedValue({ rows: [{ count: 0 }] })
    connectMock.mockResolvedValue({ query: clientQueryMock, release: releaseMock })
    clientQueryMock.mockImplementation((sql: string) => {
      if (typeof sql === 'string' && sql.includes('INSERT INTO jobs')) {
        return Promise.resolve({ rows: [{ id: 'job-123' }] })
      }
      return Promise.resolve({ rows: [] })
    })
    runMatchingForJobMock.mockResolvedValue({ jobId: 'job-123', resultCount: 0, eligibleCount: 0, excludedCount: 0 })
  })

  it('10. trackt PROJECT_CREATED genau einmal, mit jobId/actorUserId und ohne Titel/Beschreibungstext', async () => {
    await createJob(jsonReq('http://localhost/api/jobs', validBody))
    expect(trackEventMock).toHaveBeenCalledTimes(1)
    const [input] = trackEventMock.mock.calls[0]
    expect(input.event).toBe('project_created')
    expect(input.jobId).toBe('job-123')
    expect(input.actorUserId).toBe('ag-1')
    expect(input.idempotencyKey).toBe('project_created:job-123')
    expect(JSON.stringify(input.metadata)).not.toContain(validBody.title)
    expect(JSON.stringify(input.metadata)).not.toContain(validBody.description)
  })

  it('11. PROJECT_CREATED wird NACH dem erfolgreichen COMMIT persistiert', async () => {
    await createJob(jsonReq('http://localhost/api/jobs', validBody))
    const commitCallIndex = clientQueryMock.mock.calls.findIndex(([sql]) => sql === 'COMMIT')
    const commitInvocationOrder = clientQueryMock.mock.invocationCallOrder[commitCallIndex]
    const trackInvocationOrder = trackEventMock.mock.invocationCallOrder[0]
    expect(trackInvocationOrder).toBeGreaterThan(commitInvocationOrder)
  })

  it('12. kein Tracking bei fehlgeschlagener Job-Erstellung (Validierungsfehler, kein Commit)', async () => {
    await createJob(jsonReq('http://localhost/api/jobs', { title: 'zu kurz' }))
    expect(trackEventMock).not.toHaveBeenCalled()
  })

  it('ein Fehler beim PROJECT_CREATED-Tracking verhindert nicht die erfolgreiche Antwort', async () => {
    trackEventMock.mockRejectedValue(new Error('Analytics-DB down'))
    const res = await createJob(jsonReq('http://localhost/api/jobs', validBody))
    expect(res.status).toBe(200)
  })
})

// Die OFFER_ACCEPTED-Analytics-Tests für den Award-Flow sind seit Phase 3.6I (transaktionaler,
// race-condition-sicherer Award über pool.connect()/client.query() statt pool.query()) nach
// tests/routes/award-flow.test.ts umgezogen, wo sie zusammen mit der vollständigen
// Transaktions-/Race-Condition-Abdeckung liegen.

describe('Phase 3.6A — kein zweiter Matching-Trigger außerhalb von POST /api/jobs', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9)
    getCurrentUserMock.mockReset()
    queryMock.mockReset()
    connectMock.mockReset()
    clientQueryMock.mockReset()
    releaseMock.mockReset()
    runMatchingForJobMock.mockReset()
    queryMock.mockResolvedValue({ rows: [] })
    connectMock.mockResolvedValue({ query: clientQueryMock, release: releaseMock })
    clientQueryMock.mockResolvedValue({ rows: [] })
  })

  it('6. Award löst kein Matching aus', async () => {
    getCurrentUserMock.mockResolvedValue({ id: 'ag-1', role: 'auftraggeber' })
    queryMock.mockResolvedValueOnce({ rows: [] }) // Job/Offer nicht gefunden -> früher Abbruch, reicht für die Assertion
    await awardJob(jsonReq('http://localhost/api/jobs/job-1/award', { offerId: 'offer-1' }), {
      params: Promise.resolve({ id: 'job-1' }),
    })
    expect(runMatchingForJobMock).not.toHaveBeenCalled()
  })

  it('7. PATCH löst kein Matching aus', async () => {
    getCurrentUserMock.mockResolvedValue({ id: 'ag-1', role: 'auftraggeber' })
    // Phase 4.3: PATCH prüft zuerst ein Rate Limit (COUNT + INSERT über queryMock), bevor der
    // eigentliche Job-Lookup läuft.
    queryMock.mockResolvedValueOnce({ rows: [{ count: 0 }] })
    queryMock.mockResolvedValueOnce({})
    queryMock.mockResolvedValueOnce({ rows: [] }) // Job nicht gefunden -> 404
    await patchJob(
      jsonReq('http://localhost/api/jobs/job-1', { title: 'Neuer Titel lang genug', description: 'Neue Beschreibung, lang genug fuer die Validierung.' }, 'PATCH'),
      { params: Promise.resolve({ id: 'job-1' }) }
    )
    expect(runMatchingForJobMock).not.toHaveBeenCalled()
  })

  it('8. Offer-Abgabe löst kein Matching aus', async () => {
    getCurrentUserMock.mockResolvedValue({
      id: 'sub-1',
      role: 'subunternehmer',
      subscriptionStatus: 'inactive',
      subscriptionTier: null,
    })
    await submitOffer(jsonReq('http://localhost/api/jobs/job-1/offers', { price: 1000 }), {
      params: Promise.resolve({ id: 'job-1' }),
    })
    expect(runMatchingForJobMock).not.toHaveBeenCalled()
  })
})
