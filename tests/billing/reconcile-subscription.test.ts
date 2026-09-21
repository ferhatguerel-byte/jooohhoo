import { describe, it, expect, vi, beforeEach } from 'vitest'

const { queryMock, listSubscriptionsMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
  listSubscriptionsMock: vi.fn(),
}))
vi.mock('@/lib/db', () => ({ getDb: () => ({ query: queryMock }) }))
vi.mock('@/lib/stripe', () => ({
  getStripe: () => ({ subscriptions: { list: listSubscriptionsMock } }),
}))

import { reconcileUserStripeSubscription } from '@/lib/billing/reconcile-subscription'

describe('reconcileUserStripeSubscription — Phase 4.2 (Teil J/T)', () => {
  beforeEach(() => {
    queryMock.mockReset()
    listSubscriptionsMock.mockReset()
    vi.stubEnv('STRIPE_PRICE_MONTHLY', 'price_monthly')
    vi.stubEnv('STRIPE_PRICE_YEARLY', 'price_yearly')
  })

  it('Teil T.1: lokale DB inactive, Stripe active -> Reconciliation korrigiert lokal auf active', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ stripe_customer_id: 'cus_1' }] })
    listSubscriptionsMock.mockResolvedValueOnce({
      data: [{ id: 'sub_1', status: 'active', cancel_at: null, created: 1000, items: { data: [{ price: { id: 'price_monthly' } }] }, metadata: {} }],
    })
    queryMock.mockResolvedValueOnce({ rowCount: 1 })

    const result = await reconcileUserStripeSubscription('u1')
    expect(result.status).toBe('reconciled')
    const updateCall = queryMock.mock.calls[1]
    expect(updateCall[1]).toContain('active')
    expect(updateCall[1]).toContain('monthly')
  })

  it('Teil T.2: lokale DB active, Stripe canceled -> Reconciliation korrigiert lokal auf inactive', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ stripe_customer_id: 'cus_2' }] })
    listSubscriptionsMock.mockResolvedValueOnce({
      data: [{ id: 'sub_2', status: 'canceled', cancel_at: null, created: 1000, items: { data: [] }, metadata: {} }],
    })
    queryMock.mockResolvedValueOnce({ rowCount: 1 })

    const result = await reconcileUserStripeSubscription('u2')
    expect(result.status).toBe('reconciled')
    expect(queryMock.mock.calls[1][1]).toContain('inactive')
  })

  it('Teil T.3: unbekannter Stripe Customer -> sicherer Fehler, lokaler Zustand bleibt unverändert', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ stripe_customer_id: 'cus_deleted' }] })
    listSubscriptionsMock.mockRejectedValueOnce(new Error('No such customer: cus_deleted'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await reconcileUserStripeSubscription('u3')
    expect(result.status).toBe('error')
    // Kein UPDATE users wurde ausgeführt (nur die initiale SELECT).
    expect(queryMock).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })

  it('Teil T.4: keine Subscription bei Stripe -> definierter Zustand (inactive)', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ stripe_customer_id: 'cus_4' }] })
    listSubscriptionsMock.mockResolvedValueOnce({ data: [] })
    queryMock.mockResolvedValueOnce({ rowCount: 1 })

    const result = await reconcileUserStripeSubscription('u4')
    expect(result.status).toBe('no_subscription')
    expect(queryMock.mock.calls[1][0]).toContain("subscription_status = 'inactive'")
  })

  it('Teil T.5: mehrere Subscriptions -> bevorzugt eine aktive (dokumentierte, deterministische Auswahl)', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ stripe_customer_id: 'cus_5' }] })
    listSubscriptionsMock.mockResolvedValueOnce({
      data: [
        { id: 'sub_old_canceled', status: 'canceled', cancel_at: null, created: 500, items: { data: [] }, metadata: {} },
        { id: 'sub_active', status: 'active', cancel_at: null, created: 1000, items: { data: [{ price: { id: 'price_yearly' } }] }, metadata: {} },
      ],
    })
    queryMock.mockResolvedValueOnce({ rowCount: 1 })

    const result = await reconcileUserStripeSubscription('u5')
    expect(result.status).toBe('reconciled')
    expect(queryMock.mock.calls[1][1]).toContain('yearly')
  })

  it('Teil T.5b: mehrere Subscriptions, keine aktiv -> nimmt die zuletzt erstellte', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ stripe_customer_id: 'cus_6' }] })
    listSubscriptionsMock.mockResolvedValueOnce({
      data: [
        { id: 'sub_a', status: 'canceled', cancel_at: null, created: 500, items: { data: [] }, metadata: {} },
        { id: 'sub_b', status: 'canceled', cancel_at: null, created: 2000, items: { data: [] }, metadata: {} },
      ],
    })
    queryMock.mockResolvedValueOnce({ rowCount: 1 })

    await reconcileUserStripeSubscription('u6')
    const call = queryMock.mock.calls[1]
    expect(call[1]).toContain('sub_b')
  })

  it('Teil T.6: Stripe-API-Fehler -> lokaler Zustand wird nicht blind überschrieben', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ stripe_customer_id: 'cus_7' }] })
    listSubscriptionsMock.mockRejectedValueOnce(new Error('rate limited'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await reconcileUserStripeSubscription('u7')
    expect(result.status).toBe('error')
    expect(queryMock).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })

  it('kein lokaler stripe_customer_id -> no_customer, keine Stripe-Abfrage', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ stripe_customer_id: null }] })
    const result = await reconcileUserStripeSubscription('u8')
    expect(result.status).toBe('no_customer')
    expect(listSubscriptionsMock).not.toHaveBeenCalled()
  })
})
