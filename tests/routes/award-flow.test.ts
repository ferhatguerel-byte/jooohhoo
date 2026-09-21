import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { getCurrentUserMock, connectMock, clientQueryMock, releaseMock, trackEventMock, sendOfferAwardedEmailMock } = vi.hoisted(() => ({
  getCurrentUserMock: vi.fn(),
  connectMock: vi.fn(),
  clientQueryMock: vi.fn(),
  releaseMock: vi.fn(),
  trackEventMock: vi.fn(),
  sendOfferAwardedEmailMock: vi.fn(),
}))
vi.mock('@/lib/current-user', () => ({ getCurrentUser: getCurrentUserMock }))
vi.mock('@/lib/db', () => ({ getDb: () => ({ connect: connectMock }) }))
vi.mock('@/lib/email', () => ({ sendOfferAwardedEmail: sendOfferAwardedEmailMock }))
vi.mock('@/lib/analytics-events', () => ({ trackEvent: trackEventMock }))

import { POST as awardJob } from '@/app/api/jobs/[id]/award/route'

const JOB_ID = 'job-1'
const OFFER_ID = '11111111-1111-4111-8111-111111111111'
const AG = { id: 'ag-1', role: 'auftraggeber' as const }
const SUB_ID = 'sub-1'

function req(body: unknown = { offerId: OFFER_ID }) {
  return new NextRequest(`http://localhost/api/jobs/${JOB_ID}/award`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

function call(jobId = JOB_ID) {
  return awardJob(req(), { params: Promise.resolve({ id: jobId }) })
}

const OFFER_ROW = { subunternehmer_id: SUB_ID, email: 'sub@example.com', company_name: 'Sub GmbH', email_notifications: false }

/** Baut ein clientQueryMock-Implementation, das den kompletten Happy-Path abbildet. */
function happyPathClientQuery() {
  return vi.fn((sql: string) => {
    if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return Promise.resolve({ rows: [] })
    if (sql.includes('FOR UPDATE')) return Promise.resolve({ rows: [{ id: JOB_ID, status: 'open' }] })
    if (sql.includes('FROM offers o JOIN users u')) return Promise.resolve({ rows: [OFFER_ROW] })
    return Promise.resolve({ rows: [] })
  })
}

function findCalls(mockFn: ReturnType<typeof vi.fn>, fragment: string) {
  return mockFn.mock.calls.filter(([sql]) => typeof sql === 'string' && sql.includes(fragment))
}

describe('POST /api/jobs/[id]/award — Phase 3.6I Transaktionale Vergabe', () => {
  beforeEach(() => {
    getCurrentUserMock.mockReset()
    connectMock.mockReset()
    clientQueryMock.mockReset()
    releaseMock.mockReset()
    trackEventMock.mockReset()
    sendOfferAwardedEmailMock.mockReset()
    trackEventMock.mockResolvedValue(undefined)
    getCurrentUserMock.mockResolvedValue(AG)
    connectMock.mockResolvedValue({ query: clientQueryMock, release: releaseMock })
  })

  it('1. normaler Award funktioniert (200, ok:true)', async () => {
    clientQueryMock.mockImplementation(happyPathClientQuery())
    const res = await call()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('2. Job wird geschlossen (UPDATE jobs SET status = closed, awarded_subunternehmer_id gesetzt)', async () => {
    clientQueryMock.mockImplementation(happyPathClientQuery())
    await call()
    const [jobUpdateCall] = findCalls(clientQueryMock, "UPDATE jobs SET status = 'closed'")
    expect(jobUpdateCall).toBeDefined()
    expect(jobUpdateCall[1]).toEqual([SUB_ID, JOB_ID])
  })

  it('3. Ziel-Offer wird akzeptiert', async () => {
    clientQueryMock.mockImplementation(happyPathClientQuery())
    await call()
    const [acceptCall] = findCalls(clientQueryMock, "UPDATE offers SET status = 'accepted'")
    expect(acceptCall).toBeDefined()
    expect(acceptCall[1]).toEqual([OFFER_ID])
  })

  it('4. übrige Offers werden abgelehnt (nur die pending Angebote desselben Jobs, außer dem Ziel-Offer)', async () => {
    clientQueryMock.mockImplementation(happyPathClientQuery())
    await call()
    const [declineCall] = findCalls(clientQueryMock, "UPDATE offers SET status = 'declined'")
    expect(declineCall).toBeDefined()
    expect(declineCall[0]).toContain("id != $2 AND status = 'pending'")
    expect(declineCall[1]).toEqual([JOB_ID, OFFER_ID])
  })

  it('5. Award eines bereits geschlossenen Jobs schlägt fehl (409), kein UPDATE, kein Commit', async () => {
    clientQueryMock.mockImplementation((sql: string) => {
      if (sql === 'BEGIN' || sql === 'ROLLBACK') return Promise.resolve({ rows: [] })
      if (sql.includes('FOR UPDATE')) return Promise.resolve({ rows: [{ id: JOB_ID, status: 'closed' }] })
      return Promise.resolve({ rows: [] })
    })
    const res = await call()
    expect(res.status).toBe(409)
    expect(findCalls(clientQueryMock, 'UPDATE jobs')).toHaveLength(0)
    expect(findCalls(clientQueryMock, 'UPDATE offers')).toHaveLength(0)
    expect(findCalls(clientQueryMock, 'COMMIT')).toHaveLength(0)
    expect(findCalls(clientQueryMock, 'ROLLBACK')).toHaveLength(1)
  })

  it('6. falsches/nicht mehr annehmbares Offer schlägt fehl (404), kein UPDATE', async () => {
    clientQueryMock.mockImplementation((sql: string) => {
      if (sql === 'BEGIN' || sql === 'ROLLBACK') return Promise.resolve({ rows: [] })
      if (sql.includes('FOR UPDATE')) return Promise.resolve({ rows: [{ id: JOB_ID, status: 'open' }] })
      if (sql.includes('FROM offers o JOIN users u')) return Promise.resolve({ rows: [] }) // nicht gefunden / nicht mehr pending
      return Promise.resolve({ rows: [] })
    })
    const res = await call()
    expect(res.status).toBe(404)
    expect(findCalls(clientQueryMock, 'UPDATE jobs')).toHaveLength(0)
    expect(findCalls(clientQueryMock, 'UPDATE offers')).toHaveLength(0)
  })

  it('7. Offer eines anderen Jobs schlägt fehl (o.job_id ist Teil der WHERE-Bedingung)', async () => {
    clientQueryMock.mockImplementation((sql: string) => {
      if (sql === 'BEGIN' || sql === 'ROLLBACK') return Promise.resolve({ rows: [] })
      if (sql.includes('FOR UPDATE')) return Promise.resolve({ rows: [{ id: JOB_ID, status: 'open' }] })
      return Promise.resolve({ rows: [] })
    })
    await call()
    const [offerCall] = findCalls(clientQueryMock, 'FROM offers o JOIN users u')
    expect(offerCall[0]).toContain('o.job_id = $2')
    expect(offerCall[1]).toEqual([OFFER_ID, JOB_ID])
  })

  it("nur Angebote mit status = 'pending' können angenommen werden (bestehender offer_status-Enum, kein neuer Wert)", async () => {
    clientQueryMock.mockImplementation(happyPathClientQuery())
    await call()
    const [offerCall] = findCalls(clientQueryMock, 'FROM offers o JOIN users u')
    expect(offerCall[0]).toContain("o.status = 'pending'")
  })

  it('8./9. DB-Fehler während der Transaktion führt zu vollständigem Rollback, KEIN OFFER_ACCEPTED-Event', async () => {
    clientQueryMock.mockImplementation((sql: string) => {
      if (sql === 'BEGIN' || sql === 'ROLLBACK') return Promise.resolve({ rows: [] })
      if (sql.includes('FOR UPDATE')) return Promise.resolve({ rows: [{ id: JOB_ID, status: 'open' }] })
      if (sql.includes('FROM offers o JOIN users u')) return Promise.resolve({ rows: [OFFER_ROW] })
      if (sql.startsWith("UPDATE offers SET status = 'accepted'")) throw new Error('DB-Verbindung verloren')
      return Promise.resolve({ rows: [] })
    })
    const res = await call()
    expect(res.status).toBe(500)
    expect(findCalls(clientQueryMock, 'COMMIT')).toHaveLength(0)
    expect(findCalls(clientQueryMock, 'ROLLBACK')).toHaveLength(1)
    expect(trackEventMock).not.toHaveBeenCalled()
    expect(releaseMock).toHaveBeenCalled()
  })

  it('10. erfolgreicher Award erzeugt genau ein OFFER_ACCEPTED-Analytics-Event', async () => {
    clientQueryMock.mockImplementation(happyPathClientQuery())
    await call()
    expect(trackEventMock).toHaveBeenCalledTimes(1)
    expect(trackEventMock).toHaveBeenCalledWith({
      event: 'offer_accepted',
      actorUserId: AG.id,
      providerId: SUB_ID,
      jobId: JOB_ID,
      idempotencyKey: `job_awarded:${JOB_ID}`,
    })
  })

  it('11. Analytics-Event nutzt für einen Replay denselben deterministischen idempotencyKey (Dedup passiert über die DB-UNIQUE-Constraint, siehe Realtest)', async () => {
    clientQueryMock.mockImplementation(happyPathClientQuery())
    await call()
    const firstKey = trackEventMock.mock.calls[0][0].idempotencyKey
    // Zweiter Aufruf für denselben Job: SELECT ... FOR UPDATE liefert nach dem ersten (erfolgreichen)
    // Award realistisch bereits status='closed' zurück (siehe echte Postgres-Verifikation) -> 409,
    // kein zweiter Award, aber selbst wenn er (theoretisch) durchliefe, wäre der Key identisch.
    expect(firstKey).toBe(`job_awarded:${JOB_ID}`)
  })

  it('Job-Sperre nutzt SELECT ... FOR UPDATE (Grundlage der Race-Condition-Sicherheit)', async () => {
    clientQueryMock.mockImplementation(happyPathClientQuery())
    await call()
    const [jobSelectCall] = findCalls(clientQueryMock, 'FOR UPDATE')
    expect(jobSelectCall[0]).toContain('SELECT id, status FROM jobs')
    expect(jobSelectCall[0]).toContain('WHERE id = $1 AND auftraggeber_id = $2')
    expect(jobSelectCall[1]).toEqual([JOB_ID, AG.id])
  })

  it('fremder Auftraggeber kann keinen Job vergeben (Ownership-Filter im FOR-UPDATE-SELECT, IDOR-sicher, 404 statt 403)', async () => {
    clientQueryMock.mockImplementation((sql: string) => {
      if (sql === 'BEGIN' || sql === 'ROLLBACK') return Promise.resolve({ rows: [] })
      if (sql.includes('FOR UPDATE')) return Promise.resolve({ rows: [] }) // Ownership-Filter matcht nicht
      return Promise.resolve({ rows: [] })
    })
    const res = await call()
    expect(res.status).toBe(404)
  })

  it('E-Mail-Versand und Analytics laufen erst NACH client.release() (außerhalb der Transaktion/des Locks)', async () => {
    const releaseOrder: string[] = []
    releaseMock.mockImplementation(() => releaseOrder.push('release'))
    sendOfferAwardedEmailMock.mockImplementation(() => {
      releaseOrder.push('email')
      return Promise.resolve()
    })
    clientQueryMock.mockImplementation((sql: string) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') return Promise.resolve({ rows: [] })
      if (sql.includes('FOR UPDATE')) return Promise.resolve({ rows: [{ id: JOB_ID, status: 'open' }] })
      if (sql.includes('FROM offers o JOIN users u')) return Promise.resolve({ rows: [{ ...OFFER_ROW, email_notifications: true }] })
      return Promise.resolve({ rows: [] })
    })
    await call()
    expect(releaseOrder).toEqual(['release', 'email'])
  })

  it('ein Fehler beim E-Mail-Versand verhindert nicht die erfolgreiche Vergabe (best-effort, unverändertes Verhalten)', async () => {
    clientQueryMock.mockImplementation((sql: string) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') return Promise.resolve({ rows: [] })
      if (sql.includes('FOR UPDATE')) return Promise.resolve({ rows: [{ id: JOB_ID, status: 'open' }] })
      if (sql.includes('FROM offers o JOIN users u')) return Promise.resolve({ rows: [{ ...OFFER_ROW, email_notifications: true }] })
      return Promise.resolve({ rows: [] })
    })
    sendOfferAwardedEmailMock.mockRejectedValue(new Error('Resend down'))
    const res = await call()
    expect(res.status).toBe(200)
    expect(trackEventMock).toHaveBeenCalledTimes(1)
  })
})
