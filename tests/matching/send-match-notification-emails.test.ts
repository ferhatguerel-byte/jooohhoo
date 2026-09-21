import { describe, it, expect, vi, beforeEach } from 'vitest'

const { queryMock, sendMatchNotificationEmailMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
  sendMatchNotificationEmailMock: vi.fn(),
}))
vi.mock('@/lib/db', () => ({ getDb: () => ({ query: queryMock }) }))
vi.mock('@/lib/email', async () => {
  const actual = await vi.importActual<typeof import('@/lib/email')>('@/lib/email')
  return { ...actual, sendMatchNotificationEmail: sendMatchNotificationEmailMock }
})

import { sendMatchNotificationEmails } from '@/lib/matching/send-match-notification-emails'
import { ResendSendError } from '@/lib/email'
import { MAX_MATCH_EMAIL_ATTEMPTS } from '@/lib/matching/email-retry-config'

function candidateRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    notification_id: 'n1',
    provider_email: 'provider@example.com',
    email_notifications: true,
    provider_role: 'subunternehmer',
    title: 'Badezimmer renovieren',
    gewerk: 'Elektro',
    plz: '10115',
    ort: 'Berlin',
    description: 'Komplettsanierung eines Badezimmers.',
    budget_min: 5000,
    budget_max: 10000,
    deadline: null,
    ...overrides,
  }
}

describe('sendMatchNotificationEmails — Phase 3.6F Zustandsmaschine', () => {
  beforeEach(() => {
    queryMock.mockReset()
    sendMatchNotificationEmailMock.mockReset()
  })

  it('gibt eine leere Liste zurück und macht keine Query, wenn keine IDs übergeben werden', async () => {
    const result = await sendMatchNotificationEmails([])
    expect(result).toEqual([])
    expect(queryMock).not.toHaveBeenCalled()
  })

  it('Kandidaten-Query filtert NICHT mehr nach status=pending (Claim ist die alleinige Eligibility-Instanz)', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] })
    await sendMatchNotificationEmails(['n1'])
    const [sql] = queryMock.mock.calls[0]
    expect(sql).not.toContain("n.status = 'pending'")
    expect(sql).toContain('n.id = ANY($1::uuid[])')
  })

  it('erfolgreicher Versand: claim -> sending -> sent, last_error wird zurückgesetzt', async () => {
    queryMock.mockResolvedValueOnce({ rows: [candidateRow()] })
    queryMock.mockResolvedValueOnce({ rows: [{ id: 'n1' }] }) // Claim erfolgreich
    queryMock.mockResolvedValueOnce({ rows: [] }) // markSent
    sendMatchNotificationEmailMock.mockResolvedValue(undefined)

    const result = await sendMatchNotificationEmails(['n1'])

    expect(result).toEqual([{ notificationId: 'n1', sent: true }])
    const claimCall = queryMock.mock.calls[1]
    expect(claimCall[0]).toContain("SET status = 'sending', attempts = attempts + 1, processing_started_at = now(), last_error = NULL")
    expect(claimCall[0]).toContain("status = 'pending'")
    expect(claimCall[0]).toContain("status = 'failed' AND attempts < $2")
    expect(claimCall[0]).toContain("status = 'sending' AND attempts < $2")
    expect(claimCall[1]).toEqual(['n1', MAX_MATCH_EMAIL_ATTEMPTS, 60, 300, 300])
    const sentCall = queryMock.mock.calls[2]
    expect(sentCall[0]).toContain("SET status = 'sent', sent_at = now(), last_error = NULL")
  })

  it('email_notifications=false → kein Resend-Aufruf, kein Claim (kein attempts-UPDATE)', async () => {
    queryMock.mockResolvedValueOnce({ rows: [candidateRow({ email_notifications: false })] })
    const result = await sendMatchNotificationEmails(['n1'])
    expect(sendMatchNotificationEmailMock).not.toHaveBeenCalled()
    expect(queryMock).toHaveBeenCalledTimes(1)
    expect(result).toEqual([{ notificationId: 'n1', sent: false, skipReason: 'email_notifications_disabled' }])
  })

  it('unplausible/fehlende Provider-E-Mail → kein Resend-Aufruf, kein Claim', async () => {
    queryMock.mockResolvedValueOnce({ rows: [candidateRow({ provider_email: 'nicht-valide' })] })
    const result = await sendMatchNotificationEmails(['n1'])
    expect(sendMatchNotificationEmailMock).not.toHaveBeenCalled()
    expect(queryMock).toHaveBeenCalledTimes(1)
    expect(result).toEqual([{ notificationId: 'n1', sent: false, skipReason: 'invalid_email' }])
  })

  it('nicht-Provider-Rolle → kein Versand, kein Claim', async () => {
    queryMock.mockResolvedValueOnce({ rows: [candidateRow({ provider_role: 'auftraggeber' })] })
    const result = await sendMatchNotificationEmails(['n1'])
    expect(sendMatchNotificationEmailMock).not.toHaveBeenCalled()
    expect(queryMock).toHaveBeenCalledTimes(1)
    expect(result).toEqual([{ notificationId: 'n1', sent: false, skipReason: 'not_a_provider' }])
  })

  it('Claim schlägt fehl (0 Zeilen, z.B. bereits von einem anderen Worker beansprucht) → kein Versand', async () => {
    queryMock.mockResolvedValueOnce({ rows: [candidateRow()] })
    queryMock.mockResolvedValueOnce({ rows: [] }) // Claim-UPDATE betrifft 0 Zeilen
    const result = await sendMatchNotificationEmails(['n1'])
    expect(sendMatchNotificationEmailMock).not.toHaveBeenCalled()
    expect(result).toEqual([{ notificationId: 'n1', sent: false, skipReason: 'already_claimed' }])
  })

  it('transienter Resend-Fehler → status bleibt failed, attempts NICHT zusätzlich erhöht (Claim hat es bereits getan)', async () => {
    queryMock.mockResolvedValueOnce({ rows: [candidateRow()] })
    queryMock.mockResolvedValueOnce({ rows: [{ id: 'n1' }] }) // Claim
    queryMock.mockResolvedValueOnce({ rows: [] }) // markFailed
    sendMatchNotificationEmailMock.mockRejectedValue(new ResendSendError('Rate limit', 'rate_limit_exceeded'))

    const result = await sendMatchNotificationEmails(['n1'])

    expect(result).toEqual([{ notificationId: 'n1', sent: false }])
    const failedCall = queryMock.mock.calls[2]
    expect(failedCall[0]).toContain("SET status = 'failed', last_error = $2")
    expect(failedCall[0]).not.toContain('GREATEST') // kein erzwungenes Erschöpfen bei transientem Fehler
    expect(failedCall[1]).toEqual(['n1', 'Rate limit'])
  })

  it('permanenter Resend-Fehler (validation_error) → attempts wird auf MAX_MATCH_EMAIL_ATTEMPTS angehoben (kein weiterer Retry)', async () => {
    queryMock.mockResolvedValueOnce({ rows: [candidateRow()] })
    queryMock.mockResolvedValueOnce({ rows: [{ id: 'n1' }] })
    queryMock.mockResolvedValueOnce({ rows: [] })
    sendMatchNotificationEmailMock.mockRejectedValue(new ResendSendError('Ungültige Adresse', 'validation_error'))

    await sendMatchNotificationEmails(['n1'])

    const failedCall = queryMock.mock.calls[2]
    expect(failedCall[0]).toContain('GREATEST(attempts, $3)')
    expect(failedCall[1]).toEqual(['n1', 'Ungültige Adresse', MAX_MATCH_EMAIL_ATTEMPTS])
  })

  it('normale Netzwerk-Exception (kein ResendSendError) wird als transient behandelt', async () => {
    queryMock.mockResolvedValueOnce({ rows: [candidateRow()] })
    queryMock.mockResolvedValueOnce({ rows: [{ id: 'n1' }] })
    queryMock.mockResolvedValueOnce({ rows: [] })
    sendMatchNotificationEmailMock.mockRejectedValue(new Error('fetch failed'))

    await sendMatchNotificationEmails(['n1'])

    const failedCall = queryMock.mock.calls[2]
    expect(failedCall[0]).not.toContain('GREATEST')
  })

  it('lange last_error-Nachrichten werden begrenzt (kein unbegrenztes Logging)', async () => {
    queryMock.mockResolvedValueOnce({ rows: [candidateRow()] })
    queryMock.mockResolvedValueOnce({ rows: [{ id: 'n1' }] })
    queryMock.mockResolvedValueOnce({ rows: [] })
    sendMatchNotificationEmailMock.mockRejectedValue(new Error('x'.repeat(2000)))

    await sendMatchNotificationEmails(['n1'])
    const failedCall = queryMock.mock.calls[2]
    expect((failedCall[1][1] as string).length).toBeLessThanOrEqual(500)
  })

  it('keine N+1: für mehrere Notification-IDs wird nur eine Kandidaten-Query ausgeführt', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [candidateRow({ notification_id: 'n1' }), candidateRow({ notification_id: 'n2', email_notifications: false })],
    })
    queryMock.mockResolvedValueOnce({ rows: [{ id: 'n1' }] })
    queryMock.mockResolvedValueOnce({ rows: [] })
    sendMatchNotificationEmailMock.mockResolvedValue(undefined)

    await sendMatchNotificationEmails(['n1', 'n2'])
    const candidateQueryCalls = queryMock.mock.calls.filter(([sql]) => typeof sql === 'string' && sql.includes('FROM match_notifications'))
    expect(candidateQueryCalls).toHaveLength(1)
    const [, params] = candidateQueryCalls[0]
    expect(params).toEqual([['n1', 'n2']])
  })
})
