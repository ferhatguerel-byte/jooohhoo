import { describe, it, expect, vi, beforeEach } from 'vitest'

const { queryMock, sendSubscriptionConfirmationEmailMock, sendCancellationConfirmationEmailMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
  sendSubscriptionConfirmationEmailMock: vi.fn(),
  sendCancellationConfirmationEmailMock: vi.fn(),
}))
vi.mock('@/lib/db', () => ({ getDb: () => ({ query: queryMock }) }))
vi.mock('@/lib/email', async () => {
  const actual = await vi.importActual<typeof import('@/lib/email')>('@/lib/email')
  return {
    ...actual,
    sendSubscriptionConfirmationEmail: sendSubscriptionConfirmationEmailMock,
    sendCancellationConfirmationEmail: sendCancellationConfirmationEmailMock,
  }
})

import { enqueueBillingNotification, sendBillingNotifications } from '@/lib/billing/billing-notification-outbox'

beforeEach(() => {
  queryMock.mockReset()
  sendSubscriptionConfirmationEmailMock.mockReset()
  sendCancellationConfirmationEmailMock.mockReset()
})

describe('enqueueBillingNotification', () => {
  it('fügt eine Outbox-Zeile per INSERT ... ON CONFLICT DO NOTHING ein (dedupeKey-gestützte Idempotenz)', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] })
    await enqueueBillingNotification({
      userId: 'u1',
      kind: 'subscription_confirmation',
      dedupeKey: 'subscription_confirmation:evt_1',
      payload: { tierName: 'Monatspaket', priceEuroPerMonth: 119, billingNote: 'x', minimumTermMonths: 0, committedUntil: null },
    })
    expect(queryMock).toHaveBeenCalledTimes(1)
    expect(String(queryMock.mock.calls[0][0])).toContain('ON CONFLICT (dedupe_key) DO NOTHING')
    expect(queryMock.mock.calls[0][1]).toEqual([
      'u1',
      'subscription_confirmation',
      'subscription_confirmation:evt_1',
      JSON.stringify({ tierName: 'Monatspaket', priceEuroPerMonth: 119, billingNote: 'x', minimumTermMonths: 0, committedUntil: null }),
    ])
  })

  it('wirft NIEMALS, auch wenn die DB-Query fehlschlägt (darf den aufrufenden Vorgang nie blockieren)', async () => {
    queryMock.mockRejectedValueOnce(new Error('DB down'))
    await expect(
      enqueueBillingNotification({
        userId: 'u1',
        kind: 'cancellation_confirmation',
        dedupeKey: 'cancellation_confirmation:u1:2027-01-01T00:00:00.000Z',
        payload: { tierName: 'Jahrespaket', requestedAt: new Date().toISOString(), effectiveAt: new Date().toISOString() },
      })
    ).resolves.toBeUndefined()
  })
})

describe('sendBillingNotifications', () => {
  it('verwendet den atomaren Claim (UPDATE ... WHERE status=... RETURNING id) vor dem Versand', async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'n1',
            kind: 'subscription_confirmation',
            payload: { tierName: 'Monatspaket', priceEuroPerMonth: 119, billingNote: 'x', minimumTermMonths: 0, committedUntil: null },
            recipient_email: 'u@example.com',
          },
        ],
      }) // SELECT candidates
      .mockResolvedValueOnce({ rows: [{ id: 'n1' }] }) // claim UPDATE
      .mockResolvedValueOnce({ rows: [] }) // markSent

    sendSubscriptionConfirmationEmailMock.mockResolvedValue(undefined)

    const outcomes = await sendBillingNotifications(['n1'])
    expect(outcomes).toEqual([{ id: 'n1', sent: true }])
    expect(sendSubscriptionConfirmationEmailMock).toHaveBeenCalledWith(
      'u@example.com',
      expect.objectContaining({ tierName: 'Monatspaket' })
    )
    expect(String(queryMock.mock.calls[1][0])).toContain("SET status = 'sending'")
  })

  it('ein fehlgeschlagener Claim (bereits von einem parallelen Lauf beansprucht) überspringt den Versand', async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'n2',
            kind: 'subscription_confirmation',
            payload: {},
            recipient_email: 'u@example.com',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] }) // claim UPDATE: 0 Zeilen -> bereits beansprucht

    const outcomes = await sendBillingNotifications(['n2'])
    expect(outcomes).toEqual([{ id: 'n2', sent: false, skipReason: 'already_claimed' }])
    expect(sendSubscriptionConfirmationEmailMock).not.toHaveBeenCalled()
  })

  it('ein fehlgeschlagener E-Mail-Versand markiert die Zeile als failed, wirft aber nicht aus der Funktion', async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [{ id: 'n3', kind: 'cancellation_confirmation', payload: {}, recipient_email: 'u@example.com' }],
      })
      .mockResolvedValueOnce({ rows: [{ id: 'n3' }] }) // claim
      .mockResolvedValueOnce({ rows: [] }) // markFailed

    sendCancellationConfirmationEmailMock.mockRejectedValueOnce(new Error('Resend down'))

    const outcomes = await sendBillingNotifications(['n3'])
    expect(outcomes).toEqual([{ id: 'n3', sent: false }])
    expect(String(queryMock.mock.calls[2][0])).toContain("SET status = 'failed'")
  })

  it('eine ungültige Empfänger-Adresse wird übersprungen, ohne einen Claim zu versuchen', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ id: 'n4', kind: 'subscription_confirmation', payload: {}, recipient_email: 'nicht-valide' }],
    })
    const outcomes = await sendBillingNotifications(['n4'])
    expect(outcomes).toEqual([{ id: 'n4', sent: false, skipReason: 'invalid_email' }])
    expect(queryMock).toHaveBeenCalledTimes(1)
  })
})
