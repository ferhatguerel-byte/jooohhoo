import { describe, it, expect, vi, beforeEach } from 'vitest'

const { getCurrentUserMock, queryMock, subscriptionsUpdateMock, enqueueBillingNotificationMock } = vi.hoisted(() => ({
  getCurrentUserMock: vi.fn(),
  queryMock: vi.fn(),
  subscriptionsUpdateMock: vi.fn(),
  enqueueBillingNotificationMock: vi.fn(),
}))
vi.mock('@/lib/current-user', () => ({ getCurrentUser: getCurrentUserMock }))
vi.mock('@/lib/db', () => ({ getDb: () => ({ query: queryMock }) }))
vi.mock('@/lib/stripe', () => ({ getStripe: () => ({ subscriptions: { update: subscriptionsUpdateMock } }) }))
vi.mock('@/lib/billing/billing-notification-outbox', () => ({ enqueueBillingNotification: enqueueBillingNotificationMock }))

import { POST, DELETE } from '@/app/api/billing/cancel-yearly/route'

function yearlyUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'u1',
    role: 'subunternehmer',
    accountStatus: 'active',
    subscriptionTier: 'yearly',
    stripeSubscriptionId: 'sub_1',
    subscriptionCommittedUntil: '2027-01-01T00:00:00.000Z',
    ...overrides,
  }
}

beforeEach(() => {
  getCurrentUserMock.mockReset()
  queryMock.mockReset()
  subscriptionsUpdateMock.mockReset()
  enqueueBillingNotificationMock.mockReset()
})

describe('POST /api/billing/cancel-yearly — Kündigungsbestätigung (Phase 2B, Aufgabe 2)', () => {
  it('reicht eine Kündigungsbestätigung in der Outbox ein, NACHDEM Stripe + lokale DB bereits aktualisiert wurden', async () => {
    getCurrentUserMock.mockResolvedValue(yearlyUser())
    subscriptionsUpdateMock.mockResolvedValue({})
    queryMock.mockResolvedValueOnce({ rows: [] }) // UPDATE users SET subscription_cancel_at

    const res = await POST()
    expect(res.status).toBe(200)
    expect(subscriptionsUpdateMock).toHaveBeenCalled()
    expect(queryMock).toHaveBeenCalledTimes(1)
    expect(enqueueBillingNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        kind: 'cancellation_confirmation',
        dedupeKey: expect.stringContaining('cancellation_confirmation:u1:'),
        payload: expect.objectContaining({ tierName: 'Jahrespaket' }),
      })
    )
  })

  it('die Kündigung bleibt wirksam UND wird dem Nutzer korrekt als Erfolg gemeldet, selbst wenn der Outbox-Eintrag fehlschlägt', async () => {
    getCurrentUserMock.mockResolvedValue(yearlyUser())
    subscriptionsUpdateMock.mockResolvedValue({})
    queryMock.mockResolvedValueOnce({ rows: [] })
    // enqueueBillingNotification() wirft in der echten Implementierung selbst nie (siehe
    // tests/billing/billing-notification-outbox.test.ts) – dieser erzwungene Reject testet die
    // zusätzliche Verteidigungslinie (eigenes try/catch in der Route): selbst ein hier erzwungener
    // Fehler darf die bereits bei Stripe/DB wirksame Kündigung nicht als fehlgeschlagen melden.
    enqueueBillingNotificationMock.mockRejectedValueOnce(new Error('sollte laut Vertrag nie passieren'))

    const res = await POST()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })

  it('zwei aufeinanderfolgende identische Kündigungen (kein dazwischenliegendes Zurückziehen) erzeugen denselben dedupeKey', async () => {
    getCurrentUserMock.mockResolvedValue(yearlyUser())
    subscriptionsUpdateMock.mockResolvedValue({})
    queryMock.mockResolvedValue({ rows: [] })

    await POST()
    await POST()

    const keys = enqueueBillingNotificationMock.mock.calls.map((c) => c[0].dedupeKey)
    expect(keys[0]).toBe(keys[1])
  })
})

describe('DELETE /api/billing/cancel-yearly', () => {
  it('zieht eine Kündigung zurück, ohne eine zusätzliche Bestätigungs-E-Mail auszulösen (nicht Teil des beauftragten Umfangs)', async () => {
    getCurrentUserMock.mockResolvedValue(yearlyUser())
    subscriptionsUpdateMock.mockResolvedValue({})
    queryMock.mockResolvedValueOnce({ rows: [] })

    const res = await DELETE()
    expect(res.status).toBe(200)
    expect(enqueueBillingNotificationMock).not.toHaveBeenCalled()
  })
})
