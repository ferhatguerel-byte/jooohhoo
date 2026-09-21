import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { getCurrentUserMock, queryMock, connectMock, clientQueryMock, releaseMock, runMatchingForJobMock } = vi.hoisted(() => ({
  getCurrentUserMock: vi.fn(),
  queryMock: vi.fn(),
  connectMock: vi.fn(),
  clientQueryMock: vi.fn(),
  releaseMock: vi.fn(),
  runMatchingForJobMock: vi.fn(),
}))
vi.mock('@/lib/current-user', () => ({ getCurrentUser: getCurrentUserMock }))
vi.mock('@/lib/db', () => ({ getDb: () => ({ query: queryMock, connect: connectMock }) }))
vi.mock('@/lib/matching/run-matching', () => ({ runMatchingForJob: runMatchingForJobMock }))
vi.mock('@/lib/email', () => ({ sendOfferAwardedEmail: vi.fn(), sendNewOfferEmail: vi.fn() }))

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
    getCurrentUserMock.mockReset()
    queryMock.mockReset()
    connectMock.mockReset()
    clientQueryMock.mockReset()
    releaseMock.mockReset()
    runMatchingForJobMock.mockReset()

    getCurrentUserMock.mockResolvedValue({ id: 'ag-1', role: 'auftraggeber' })
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

describe('Phase 3.6A — kein zweiter Matching-Trigger außerhalb von POST /api/jobs', () => {
  beforeEach(() => {
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
