import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { getCurrentUserMock, queryMock, retrieveSubscriptionMock, createPreviewMock } = vi.hoisted(() => ({
  getCurrentUserMock: vi.fn(),
  queryMock: vi.fn(),
  retrieveSubscriptionMock: vi.fn(),
  createPreviewMock: vi.fn(),
}))
vi.mock('@/lib/current-user', () => ({ getCurrentUser: getCurrentUserMock }))
vi.mock('@/lib/db', () => ({ getDb: () => ({ query: queryMock }) }))
vi.mock('@/lib/stripe', () => ({
  getStripe: () => ({
    subscriptions: { retrieve: retrieveSubscriptionMock },
    invoices: { createPreview: createPreviewMock },
  }),
}))

import { POST } from '@/app/api/billing/tier-change-preview/route'

function req(tier: 'monthly' | 'yearly' = 'yearly') {
  return new NextRequest('http://localhost/api/billing/tier-change-preview', {
    method: 'POST',
    body: JSON.stringify({ tier }),
    headers: { 'content-type': 'application/json' },
  })
}

function activeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'u1',
    email: 'unternehmer@example.com',
    role: 'subunternehmer',
    accountStatus: 'active',
    subscriptionStatus: 'active',
    subscriptionTier: 'monthly',
    stripeSubscriptionId: 'sub_1',
    stripeCustomerId: 'cus_1',
    ...overrides,
  }
}

beforeEach(() => {
  getCurrentUserMock.mockReset()
  queryMock.mockReset()
  retrieveSubscriptionMock.mockReset()
  createPreviewMock.mockReset()
  vi.stubEnv('STRIPE_PRICE_MONTHLY', 'price_monthly')
  vi.stubEnv('STRIPE_PRICE_YEARLY', 'price_yearly')
})

describe('POST /api/billing/tier-change-preview', () => {
  it('lehnt Auftraggeber ab (nur Unternehmer können ein Abo wechseln)', async () => {
    getCurrentUserMock.mockResolvedValue(activeUser({ role: 'auftraggeber' }))
    const res = await POST(req())
    expect(res.status).toBe(403)
    expect(createPreviewMock).not.toHaveBeenCalled()
  })

  it('lehnt eine Vorschau ohne aktives Abo ab', async () => {
    getCurrentUserMock.mockResolvedValue(activeUser({ subscriptionStatus: 'inactive', stripeSubscriptionId: null }))
    const res = await POST(req())
    expect(res.status).toBe(409)
  })

  it('lehnt eine Vorschau auf den bereits aktiven Tarif ab', async () => {
    getCurrentUserMock.mockResolvedValue(activeUser({ subscriptionTier: 'yearly' }))
    const res = await POST(req('yearly'))
    expect(res.status).toBe(409)
  })

  it('lehnt einen Downgrade-Wechsel während der Jahrespaket-Mindestlaufzeit ab, OHNE eine Stripe-Vorschau zu berechnen', async () => {
    getCurrentUserMock.mockResolvedValue(activeUser({ subscriptionTier: 'yearly' }))
    const res = await POST(req('monthly'))
    expect(res.status).toBe(409)
    expect(createPreviewMock).not.toHaveBeenCalled()
  })

  it('berechnet eine Vorschau über Stripe und speichert sie, OHNE die Subscription auszuführen', async () => {
    getCurrentUserMock.mockResolvedValue(activeUser())
    retrieveSubscriptionMock.mockResolvedValue({ items: { data: [{ id: 'si_1' }] } })
    createPreviewMock.mockResolvedValue({ amount_due: 1234, currency: 'eur', period_end: 1_800_000_000 })
    queryMock.mockResolvedValueOnce({ rows: [{ id: 'preview-1' }] })

    const res = await POST(req('yearly'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toMatchObject({ id: 'preview-1', targetTier: 'yearly', amountDueCents: 1234, currency: 'eur' })
    expect(createPreviewMock).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: 'cus_1',
        subscription: 'sub_1',
        subscription_details: expect.objectContaining({
          items: [{ id: 'si_1', price: 'price_yearly' }],
          proration_behavior: 'create_prorations',
        }),
      })
    )
    // Keine Ausführung: niemals subscriptions.update in dieser Route.
    expect(queryMock).toHaveBeenCalledTimes(1)
    expect(String(queryMock.mock.calls[0][0])).toContain('INSERT INTO billing_tier_change_previews')
  })
})
