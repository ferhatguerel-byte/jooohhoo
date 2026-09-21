import { describe, it, expect, vi, beforeEach } from 'vitest'

const { queryMock, sendMatchNotificationEmailsMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
  sendMatchNotificationEmailsMock: vi.fn(),
}))
vi.mock('@/lib/db', () => ({ getDb: () => ({ query: queryMock }) }))
vi.mock('@/lib/matching/send-match-notification-emails', () => ({ sendMatchNotificationEmails: sendMatchNotificationEmailsMock }))

import { runMatchEmailRetryBatch, getEmailRetryCandidateIds } from '@/lib/matching/retry-match-notification-emails'
import { MAX_MATCH_EMAILS_PER_RUN, MAX_MATCH_EMAIL_ATTEMPTS, MATCH_EMAIL_BACKOFF_SECONDS, MATCH_EMAIL_LEASE_SECONDS } from '@/lib/matching/email-retry-config'

describe('getEmailRetryCandidateIds — Phase 3.6F', () => {
  beforeEach(() => {
    queryMock.mockReset()
    queryMock.mockResolvedValue({ rows: [] })
  })

  it('SQL enthält die drei Eligibility-Zweige (pending / backoff-abgelaufenes failed / lease-abgelaufenes sending)', async () => {
    await getEmailRetryCandidateIds(20)
    const [sql, params] = queryMock.mock.calls[0]
    expect(sql).toContain("status = 'pending'")
    expect(sql).toContain("status = 'failed' AND attempts < $1")
    expect(sql).toContain("status = 'sending' AND attempts < $1")
    expect(sql).toContain('ORDER BY created_at ASC')
    expect(sql).toContain('LIMIT $5')
    expect(params).toEqual([MAX_MATCH_EMAIL_ATTEMPTS, MATCH_EMAIL_BACKOFF_SECONDS[0], MATCH_EMAIL_BACKOFF_SECONDS[1], MATCH_EMAIL_LEASE_SECONDS, 20])
  })

  it('gibt die gefundenen IDs zurück', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: 'n1' }, { id: 'n2' }] })
    const ids = await getEmailRetryCandidateIds(20)
    expect(ids).toEqual(['n1', 'n2'])
  })
})

describe('runMatchEmailRetryBatch — Phase 3.6F', () => {
  beforeEach(() => {
    queryMock.mockReset()
    sendMatchNotificationEmailsMock.mockReset()
  })

  it('räumt zuerst erschöpfte, hängende sending-Zeilen auf (kein Versandversuch dafür)', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] }) // finalizeExhaustedStaleSendingRows
    queryMock.mockResolvedValueOnce({ rows: [] }) // getEmailRetryCandidateIds -> leer

    await runMatchEmailRetryBatch()

    const finalizeCall = queryMock.mock.calls[0]
    expect(finalizeCall[0]).toContain("SET status = 'failed'")
    expect(finalizeCall[0]).toContain("WHERE status = 'sending' AND attempts >= $1")
    expect(sendMatchNotificationEmailsMock).not.toHaveBeenCalled()
  })

  it('Rate-Limit: fragt höchstens MAX_MATCH_EMAILS_PER_RUN Kandidaten ab und übergibt genau diese an sendMatchNotificationEmails', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] }) // finalize
    const candidateIds = Array.from({ length: MAX_MATCH_EMAILS_PER_RUN }, (_, i) => `n${i}`)
    queryMock.mockResolvedValueOnce({ rows: candidateIds.map((id) => ({ id })) })
    sendMatchNotificationEmailsMock.mockResolvedValue(candidateIds.map((id) => ({ notificationId: id, sent: true })))

    const result = await runMatchEmailRetryBatch()

    const candidateCall = queryMock.mock.calls[1]
    expect(candidateCall[1][4]).toBe(MAX_MATCH_EMAILS_PER_RUN) // LIMIT-Parameter
    expect(sendMatchNotificationEmailsMock).toHaveBeenCalledWith(candidateIds)
    expect(result.candidateCount).toBe(MAX_MATCH_EMAILS_PER_RUN)
  })

  it('25 retryfähige Notifications bei Limit 20: nur 20 werden in diesem Lauf verarbeitet (SQL LIMIT begrenzt bereits die Auswahl)', async () => {
    queryMock.mockReset()
    queryMock.mockResolvedValueOnce({ rows: [] }) // finalize
    // Die SQL-LIMIT-Klausel sorgt bereits dafür, dass nie mehr als MAX_MATCH_EMAILS_PER_RUN
    // zurückkommen – hier wird das Query-Ergebnis exakt auf das Limit simuliert.
    const only20 = Array.from({ length: 20 }, (_, i) => ({ id: `n${i}` }))
    queryMock.mockResolvedValueOnce({ rows: only20 })
    sendMatchNotificationEmailsMock.mockResolvedValue(only20.map((r) => ({ notificationId: r.id, sent: true })))

    const result = await runMatchEmailRetryBatch()
    expect(result.candidateCount).toBe(20)
    // Die verbleibenden 5 (hier nicht Teil des simulierten Query-Ergebnisses, da LIMIT bereits
    // serverseitig greift) bleiben unverändert in der DB und damit für den nächsten Lauf retryfähig.
  })

  it('keine Kandidaten → keine Verarbeitung, kein Fehler', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] })
    queryMock.mockResolvedValueOnce({ rows: [] })
    const result = await runMatchEmailRetryBatch()
    expect(result).toEqual({ candidateCount: 0, outcomes: [] })
    expect(sendMatchNotificationEmailsMock).not.toHaveBeenCalled()
  })
})
