import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import Stripe from 'stripe'

const {
  getCurrentUserMock,
  queryMock,
  customersRetrieveMock,
  customersListMock,
  customersCreateMock,
  sessionsCreateMock,
} = vi.hoisted(() => ({
  getCurrentUserMock: vi.fn(),
  queryMock: vi.fn(),
  customersRetrieveMock: vi.fn(),
  customersListMock: vi.fn(),
  customersCreateMock: vi.fn(),
  sessionsCreateMock: vi.fn(),
}))

vi.mock('@/lib/current-user', () => ({ getCurrentUser: getCurrentUserMock }))
vi.mock('@/lib/db', () => ({ getDb: () => ({ query: queryMock }) }))
vi.mock('@/lib/stripe', () => ({
  getStripe: () => ({
    customers: { retrieve: customersRetrieveMock, list: customersListMock, create: customersCreateMock },
    checkout: { sessions: { create: sessionsCreateMock } },
  }),
}))

import { POST, stripeCustomerCreateIdempotencyKey } from '@/app/api/billing/checkout/route'

function req(tier: 'monthly' | 'yearly' = 'monthly') {
  return new NextRequest('http://localhost/api/billing/checkout', {
    method: 'POST',
    body: JSON.stringify({ tier }),
    headers: { 'content-type': 'application/json' },
  })
}

function baseUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'u1',
    role: 'subunternehmer',
    email: 'unternehmer@example.com',
    companyName: 'Testbetrieb GmbH',
    subscriptionStatus: null,
    subscriptionTier: null,
    stripeSubscriptionId: null,
    stripeCustomerId: null,
    ...overrides,
  }
}

/** "No such customer: cus_..." — exakt der von Stripe für eine im aktuellen Konto/Modus unbekannte ID gemeldete Fehler. */
function resourceMissingError() {
  return new Stripe.errors.StripeInvalidRequestError({
    message: 'No such customer: cus_invalid',
    type: 'invalid_request_error',
    code: 'resource_missing',
  })
}

describe('stripeCustomerCreateIdempotencyKey', () => {
  it('ist deterministisch für dieselbe userId', () => {
    expect(stripeCustomerCreateIdempotencyKey('u1')).toBe(stripeCustomerCreateIdempotencyKey('u1'))
  })

  it('unterscheidet sich zwischen verschiedenen Usern', () => {
    expect(stripeCustomerCreateIdempotencyKey('u1')).not.toBe(stripeCustomerCreateIdempotencyKey('u2'))
  })

  it('enthält weder die rohe userId noch E-Mail/PII im Klartext (SHA-256-Hex)', () => {
    const key = stripeCustomerCreateIdempotencyKey('u1')
    expect(key).toMatch(/^[a-f0-9]{64}$/)
    expect(key).not.toContain('u1')
  })
})

describe('POST /api/billing/checkout — Stripe-Customer-Auflösung', () => {
  beforeEach(() => {
    getCurrentUserMock.mockReset()
    queryMock.mockReset()
    customersRetrieveMock.mockReset()
    customersListMock.mockReset()
    customersCreateMock.mockReset()
    sessionsCreateMock.mockReset()
    vi.stubEnv('STRIPE_PRICE_MONTHLY', 'price_monthly')
    vi.stubEnv('STRIPE_PRICE_YEARLY', 'price_yearly')
  })

  it('verwendet eine gültige, bestehende Live-Customer-ID direkt, ohne neuen Customer anzulegen', async () => {
    getCurrentUserMock.mockResolvedValue(baseUser({ stripeCustomerId: 'cus_valid_live' }))
    customersRetrieveMock.mockResolvedValue({ id: 'cus_valid_live', deleted: false })
    sessionsCreateMock.mockResolvedValue({ url: 'https://checkout.stripe.com/session/abc' })

    const res = await POST(req())

    expect(res.status).toBe(200)
    expect(customersRetrieveMock).toHaveBeenCalledWith('cus_valid_live')
    expect(customersListMock).not.toHaveBeenCalled()
    expect(customersCreateMock).not.toHaveBeenCalled()
    expect(queryMock).not.toHaveBeenCalled()
    expect(sessionsCreateMock).toHaveBeenCalledWith(expect.objectContaining({ customer: 'cus_valid_live' }))
  })

  it('löst eine nicht existierende (z.B. aus Test/Sandbox stammende) Customer-ID auf, wenn ein bestehender Customer per E-Mail gefunden wird', async () => {
    getCurrentUserMock.mockResolvedValue(baseUser({ stripeCustomerId: 'cus_from_sandbox' }))
    customersRetrieveMock.mockRejectedValue(resourceMissingError())
    customersListMock.mockResolvedValue({ data: [{ id: 'cus_found_by_email' }] })
    queryMock.mockResolvedValue({ rows: [] })
    sessionsCreateMock.mockResolvedValue({ url: 'https://checkout.stripe.com/session/abc' })

    const res = await POST(req())

    expect(res.status).toBe(200)
    expect(customersListMock).toHaveBeenCalledWith({ email: 'unternehmer@example.com', limit: 1 })
    expect(customersCreateMock).not.toHaveBeenCalled()
    expect(queryMock).toHaveBeenCalledWith('UPDATE users SET stripe_customer_id = $1 WHERE id = $2', [
      'cus_found_by_email',
      'u1',
    ])
    expect(sessionsCreateMock).toHaveBeenCalledWith(expect.objectContaining({ customer: 'cus_found_by_email' }))
  })

  it('erstellt einen neuen Live-Customer MIT deterministischem Idempotency-Key, wenn weder eine gültige gespeicherte ID noch ein bestehender Customer per E-Mail gefunden wird', async () => {
    getCurrentUserMock.mockResolvedValue(baseUser({ stripeCustomerId: 'cus_from_sandbox' }))
    customersRetrieveMock.mockRejectedValue(resourceMissingError())
    customersListMock.mockResolvedValue({ data: [] })
    customersCreateMock.mockResolvedValue({ id: 'cus_new_live' })
    queryMock.mockResolvedValue({ rows: [] })
    sessionsCreateMock.mockResolvedValue({ url: 'https://checkout.stripe.com/session/abc' })

    const res = await POST(req())

    expect(res.status).toBe(200)
    expect(customersCreateMock).toHaveBeenCalledWith(
      { email: 'unternehmer@example.com', name: 'Testbetrieb GmbH', metadata: { userId: 'u1' } },
      { idempotencyKey: stripeCustomerCreateIdempotencyKey('u1') }
    )
    expect(queryMock).toHaveBeenCalledWith('UPDATE users SET stripe_customer_id = $1 WHERE id = $2', [
      'cus_new_live',
      'u1',
    ])
    expect(sessionsCreateMock).toHaveBeenCalledWith(expect.objectContaining({ customer: 'cus_new_live' }))
  })

  it('legt für einen Nutzer ohne gespeicherte Customer-ID einen Customer mit Idempotency-Key an (unverändertes bestehendes Verhalten + neue Absicherung)', async () => {
    getCurrentUserMock.mockResolvedValue(baseUser({ stripeCustomerId: null }))
    customersListMock.mockResolvedValue({ data: [] })
    customersCreateMock.mockResolvedValue({ id: 'cus_brand_new' })
    queryMock.mockResolvedValue({ rows: [] })
    sessionsCreateMock.mockResolvedValue({ url: 'https://checkout.stripe.com/session/abc' })

    const res = await POST(req())

    expect(res.status).toBe(200)
    expect(customersRetrieveMock).not.toHaveBeenCalled()
    expect(customersCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'unternehmer@example.com' }),
      { idempotencyKey: stripeCustomerCreateIdempotencyKey('u1') }
    )
    expect(sessionsCreateMock).toHaveBeenCalledWith(expect.objectContaining({ customer: 'cus_brand_new' }))
  })

  it('zwei praktisch gleichzeitige Checkout-Requests desselben Users verwenden identische Idempotency-Keys (Voraussetzung für Stripes serverseitige Deduplizierung)', async () => {
    getCurrentUserMock.mockResolvedValue(baseUser({ stripeCustomerId: null }))
    customersListMock.mockResolvedValue({ data: [] })
    // In der echten Stripe-API würde der zweite Aufruf mit demselben Idempotency-Key + denselben
    // Parametern denselben Customer zurückliefern statt einen zweiten anzulegen – das kann ein
    // reiner Unit-Test (ohne echte Stripe-Anbindung) nicht simulieren. Geprüft wird hier die dafür
    // notwendige Voraussetzung auf unserer Seite: beide parallelen Aufrufe senden exakt denselben Key.
    customersCreateMock.mockResolvedValue({ id: 'cus_deduped_by_stripe' })
    queryMock.mockResolvedValue({ rows: [] })
    sessionsCreateMock.mockResolvedValue({ url: 'https://checkout.stripe.com/session/abc' })

    const [resA, resB] = await Promise.all([POST(req()), POST(req())])

    expect(resA.status).toBe(200)
    expect(resB.status).toBe(200)
    expect(customersCreateMock).toHaveBeenCalledTimes(2)
    const [callA, callB] = customersCreateMock.mock.calls
    expect(callA[1]).toEqual({ idempotencyKey: stripeCustomerCreateIdempotencyKey('u1') })
    expect(callB[1]).toEqual({ idempotencyKey: stripeCustomerCreateIdempotencyKey('u1') })
    expect(callA[1]).toEqual(callB[1])
    // Am Ende wird für beide Requests dieselbe (von Stripe deduplizierte) Customer-ID gespeichert.
    expect(queryMock).toHaveBeenCalledTimes(2)
    expect(queryMock).toHaveBeenNthCalledWith(1, 'UPDATE users SET stripe_customer_id = $1 WHERE id = $2', [
      'cus_deduped_by_stripe',
      'u1',
    ])
    expect(queryMock).toHaveBeenNthCalledWith(2, 'UPDATE users SET stripe_customer_id = $1 WHERE id = $2', [
      'cus_deduped_by_stripe',
      'u1',
    ])
  })

  it('verwendet bei einer Wiederholung desselben Checkout-Requests wieder denselben Idempotency-Key', async () => {
    getCurrentUserMock.mockResolvedValue(baseUser({ stripeCustomerId: null }))
    customersListMock.mockResolvedValue({ data: [] })
    customersCreateMock.mockResolvedValue({ id: 'cus_retry_same' })
    queryMock.mockResolvedValue({ rows: [] })
    sessionsCreateMock.mockResolvedValue({ url: 'https://checkout.stripe.com/session/abc' })

    await POST(req())
    await POST(req())

    expect(customersCreateMock).toHaveBeenCalledTimes(2)
    const [firstCall, secondCall] = customersCreateMock.mock.calls
    expect(firstCall[1]).toEqual(secondCall[1])
  })

  it('gibt einen unerwarteten Stripe-Fehler bei retrieve() weiterhin als 500 zurück und legt keinen Customer an', async () => {
    getCurrentUserMock.mockResolvedValue(baseUser({ stripeCustomerId: 'cus_valid_live' }))
    customersRetrieveMock.mockRejectedValue(new Error('Netzwerkfehler'))

    const res = await POST(req())

    expect(res.status).toBe(500)
    expect(customersListMock).not.toHaveBeenCalled()
    expect(customersCreateMock).not.toHaveBeenCalled()
  })

  it('gibt einen unerwarteten Stripe-Fehler bei list() weiterhin als 500 zurück und legt keinen Customer an', async () => {
    getCurrentUserMock.mockResolvedValue(baseUser({ stripeCustomerId: null }))
    customersListMock.mockRejectedValue(new Error('Netzwerkfehler'))

    const res = await POST(req())

    expect(res.status).toBe(500)
    expect(customersCreateMock).not.toHaveBeenCalled()
    expect(queryMock).not.toHaveBeenCalled()
  })

  it('gibt einen unerwarteten Stripe-Fehler bei create() weiterhin als 500 zurück, ohne die DB zu aktualisieren', async () => {
    getCurrentUserMock.mockResolvedValue(baseUser({ stripeCustomerId: null }))
    customersListMock.mockResolvedValue({ data: [] })
    customersCreateMock.mockRejectedValue(
      new Stripe.errors.StripeAuthenticationError({ message: 'Invalid API Key', type: 'invalid_request_error' })
    )

    const res = await POST(req())

    expect(res.status).toBe(500)
    expect(queryMock).not.toHaveBeenCalled()
  })

  it('Rate-Limit-Fehler von Stripe bei retrieve() führen nicht zur Customer-Neuanlage', async () => {
    getCurrentUserMock.mockResolvedValue(baseUser({ stripeCustomerId: 'cus_valid_live' }))
    customersRetrieveMock.mockRejectedValue(
      new Stripe.errors.StripeRateLimitError({ message: 'Too many requests', type: 'rate_limit_error' })
    )

    const res = await POST(req())

    expect(res.status).toBe(500)
    expect(customersCreateMock).not.toHaveBeenCalled()
  })
})
