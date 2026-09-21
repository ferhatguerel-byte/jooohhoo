import { describe, it, expect, vi, beforeEach } from 'vitest'

const { queryMock, sendMatchNotificationEmailMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
  sendMatchNotificationEmailMock: vi.fn(),
}))
vi.mock('@/lib/db', () => ({ getDb: () => ({ query: queryMock }) }))
vi.mock('@/lib/email', () => ({ sendMatchNotificationEmail: sendMatchNotificationEmailMock }))

import { sendMatchNotificationEmails } from '@/lib/matching/send-match-notification-emails'

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

describe('sendMatchNotificationEmails — Phase 3.6D', () => {
  beforeEach(() => {
    queryMock.mockReset()
    sendMatchNotificationEmailMock.mockReset()
  })

  it('gibt eine leere Liste zurück und macht keine Query, wenn keine IDs übergeben werden', async () => {
    const result = await sendMatchNotificationEmails([])
    expect(result).toEqual([])
    expect(queryMock).not.toHaveBeenCalled()
  })

  it('A1/A2: pending + email_notifications=true + gültige E-Mail → Resend wird aufgerufen, status=sent', async () => {
    queryMock.mockResolvedValueOnce({ rows: [candidateRow()] }) // Kandidaten-Query
    queryMock.mockResolvedValueOnce({ rows: [{ id: 'n1' }] }) // Claim erfolgreich
    queryMock.mockResolvedValueOnce({ rows: [] }) // markSent
    sendMatchNotificationEmailMock.mockResolvedValue(undefined)

    const result = await sendMatchNotificationEmails(['n1'])

    expect(sendMatchNotificationEmailMock).toHaveBeenCalledWith(
      'provider@example.com',
      expect.objectContaining({ title: 'Badezimmer renovieren', gewerk: 'Elektro' })
    )
    expect(result).toEqual([{ notificationId: 'n1', sent: true }])
    const claimCall = queryMock.mock.calls[1]
    expect(claimCall[0]).toContain("SET status = 'failed', attempts = attempts + 1")
    expect(claimCall[0]).toContain("WHERE id = $1 AND status = 'pending'")
    const sentCall = queryMock.mock.calls[2]
    expect(sentCall[0]).toContain("SET status = 'sent', sent_at = now()")
  })

  it('B3: email_notifications=false → kein Resend-Aufruf, kein Claim (kein attempts-UPDATE)', async () => {
    queryMock.mockResolvedValueOnce({ rows: [candidateRow({ email_notifications: false })] })
    const result = await sendMatchNotificationEmails(['n1'])
    expect(sendMatchNotificationEmailMock).not.toHaveBeenCalled()
    expect(queryMock).toHaveBeenCalledTimes(1) // nur die Kandidaten-Query, kein Claim-UPDATE
    expect(result).toEqual([{ notificationId: 'n1', sent: false, skipReason: 'email_notifications_disabled' }])
  })

  it('B4: unplausible/fehlende Provider-E-Mail → kein Resend-Aufruf, kein Claim', async () => {
    queryMock.mockResolvedValueOnce({ rows: [candidateRow({ provider_email: 'nicht-valide' })] })
    const result = await sendMatchNotificationEmails(['n1'])
    expect(sendMatchNotificationEmailMock).not.toHaveBeenCalled()
    expect(queryMock).toHaveBeenCalledTimes(1)
    expect(result).toEqual([{ notificationId: 'n1', sent: false, skipReason: 'invalid_email' }])
  })

  it('B5/B6: Notification bereits sent bzw. nicht pending → Kandidaten-Query (WHERE status=pending) liefert sie gar nicht erst zurück', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] }) // WHERE status='pending' filtert sie aus
    const result = await sendMatchNotificationEmails(['already-sent'])
    expect(sendMatchNotificationEmailMock).not.toHaveBeenCalled()
    expect(result).toEqual([])
    const [sql] = queryMock.mock.calls[0]
    expect(sql).toContain("n.status = 'pending'")
  })

  it('nicht-Provider-Rolle (Datenintegritäts-Schutz) → kein Versand, kein Claim', async () => {
    queryMock.mockResolvedValueOnce({ rows: [candidateRow({ provider_role: 'auftraggeber' })] })
    const result = await sendMatchNotificationEmails(['n1'])
    expect(sendMatchNotificationEmailMock).not.toHaveBeenCalled()
    expect(queryMock).toHaveBeenCalledTimes(1)
    expect(result).toEqual([{ notificationId: 'n1', sent: false, skipReason: 'not_a_provider' }])
  })

  it('C10: Claim schlägt fehl (0 Zeilen, z.B. durch parallelen zweiten Versuch) → kein Versand, kein zweiter erfolgreicher Claim', async () => {
    queryMock.mockResolvedValueOnce({ rows: [candidateRow()] })
    queryMock.mockResolvedValueOnce({ rows: [] }) // Claim-UPDATE betrifft 0 Zeilen -> bereits geclaimt
    const result = await sendMatchNotificationEmails(['n1'])
    expect(sendMatchNotificationEmailMock).not.toHaveBeenCalled()
    expect(result).toEqual([{ notificationId: 'n1', sent: false, skipReason: 'already_claimed' }])
  })

  it('D12: Resend-Fehler → kein sent, last_error gesetzt, attempts war bereits beim Claim erhöht (kein zweites Increment)', async () => {
    queryMock.mockResolvedValueOnce({ rows: [candidateRow()] })
    queryMock.mockResolvedValueOnce({ rows: [{ id: 'n1' }] }) // Claim erfolgreich (attempts+1 geschah hier)
    queryMock.mockResolvedValueOnce({ rows: [] }) // markFailed
    sendMatchNotificationEmailMock.mockRejectedValue(new Error('Resend API 500'))

    const result = await sendMatchNotificationEmails(['n1'])

    expect(result).toEqual([{ notificationId: 'n1', sent: false }])
    const failedCall = queryMock.mock.calls[2]
    expect(failedCall[0]).toContain('SET last_error = $2')
    expect(failedCall[0]).not.toContain('attempts') // kein zweites Increment im Fehler-Pfad
    expect(failedCall[1]).toEqual(['n1', 'Resend API 500'])
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
