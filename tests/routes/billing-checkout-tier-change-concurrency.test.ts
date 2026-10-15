import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * Phase 2G.5 – Konkurrenz-Tests für den Tarifwechsel (Monat -> Jahr) in `checkout/route.ts`
 * gegen die Admin-Kündigung UND die Jahreskündigung (`cancel-yearly`). Alle drei Routen werden
 * hier zusammen importiert, damit echte Lock-Konkurrenz über denselben gemockten DB-Pool
 * nachgebildet werden kann (gleiches Muster wie tests/routes/admin-cancel-subscription.test.ts).
 */

const {
  requireAdminApiMock,
  getCurrentUserMock,
  queryMock,
  connectMock,
  stripeCancelMock,
  stripeUpdateMock,
  stripeRetrieveMock,
  logAdminActionMock,
  enqueueBillingNotificationMock,
} = vi.hoisted(() => ({
  requireAdminApiMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
  queryMock: vi.fn(),
  connectMock: vi.fn(),
  stripeCancelMock: vi.fn(),
  stripeUpdateMock: vi.fn(),
  stripeRetrieveMock: vi.fn(),
  logAdminActionMock: vi.fn(),
  enqueueBillingNotificationMock: vi.fn(),
}))

vi.mock('@/lib/authorization', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  requireAdminApi: requireAdminApiMock,
}))
vi.mock('@/lib/current-user', () => ({ getCurrentUser: getCurrentUserMock }))
vi.mock('@/lib/db', () => ({ getDb: () => ({ query: queryMock, connect: connectMock }) }))
vi.mock('@/lib/stripe', () => ({
  getStripe: () => ({
    subscriptions: { cancel: stripeCancelMock, update: stripeUpdateMock, retrieve: stripeRetrieveMock },
  }),
}))
vi.mock('@/lib/admin-audit', () => ({ logAdminAction: logAdminActionMock }))
vi.mock('@/lib/billing/billing-notification-outbox', () => ({ enqueueBillingNotification: enqueueBillingNotificationMock }))

import { POST as checkout } from '@/app/api/billing/checkout/route'
import { POST as cancelYearly } from '@/app/api/billing/cancel-yearly/route'
import { POST as adminCancelSubscription } from '@/app/api/admin/users/[id]/cancel-subscription/route'

const USER_ID = 'u1'
const PREVIEW_ID = '22222222-2222-4222-8222-222222222222'

function checkoutReq(previewId = PREVIEW_ID) {
  return new NextRequest('http://localhost/api/billing/checkout', {
    method: 'POST',
    body: JSON.stringify({ tier: 'yearly', previewId }),
    headers: { 'content-type': 'application/json' },
  })
}

function adminReq() {
  return new NextRequest(`http://localhost/api/admin/users/${USER_ID}/cancel-subscription`, { method: 'POST' })
}

function userWithActiveMonthly(overrides: Record<string, unknown> = {}) {
  return {
    id: USER_ID,
    role: 'subunternehmer',
    accountStatus: 'active',
    email: 'unternehmer@example.com',
    companyName: 'Testbetrieb GmbH',
    subscriptionStatus: 'active',
    subscriptionTier: 'monthly',
    stripeSubscriptionId: 'sub_1',
    stripeCustomerId: 'cus_1',
    subscriptionCommittedUntil: null,
    ...overrides,
  }
}

function createLockSimulator(heldUsers: Set<string>) {
  const createdClients: { query: ReturnType<typeof vi.fn>; release: ReturnType<typeof vi.fn> }[] = []
  connectMock.mockImplementation(async () => {
    const client = {
      query: vi.fn(async (sql: string, params: unknown[] = []) => {
        const userId = params[0] as string
        if (sql.includes('pg_try_advisory_lock')) {
          if (heldUsers.has(userId)) return { rows: [{ locked: false }] }
          heldUsers.add(userId)
          return { rows: [{ locked: true }] }
        }
        if (sql.includes('pg_advisory_unlock')) {
          heldUsers.delete(userId)
          return { rows: [{ unlocked: true }] }
        }
        return { rows: [] }
      }),
      release: vi.fn(),
    }
    createdClients.push(client)
    return client
  })
  return createdClients
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

function mockClaimPreview() {
  queryMock.mockResolvedValueOnce({
    rows: [{ id: PREVIEW_ID, target_tier: 'yearly', stripe_subscription_id: 'sub_1' }],
  })
}

function mockAdminLookup(overrides: Record<string, unknown> = {}) {
  queryMock.mockResolvedValueOnce({
    rows: [{ stripe_subscription_id: 'sub_1', subscription_status: 'active', ...overrides }],
  })
}

beforeEach(() => {
  requireAdminApiMock.mockReset()
  requireAdminApiMock.mockResolvedValue({ id: 'admin-1' })
  getCurrentUserMock.mockReset()
  queryMock.mockReset()
  connectMock.mockReset()
  stripeCancelMock.mockReset()
  stripeUpdateMock.mockReset()
  stripeRetrieveMock.mockReset()
  stripeRetrieveMock.mockResolvedValue({ items: { data: [{ id: 'si_1' }] } })
  logAdminActionMock.mockReset()
  enqueueBillingNotificationMock.mockReset()
  vi.stubEnv('STRIPE_PRICE_MONTHLY', 'price_monthly')
  vi.stubEnv('STRIPE_PRICE_YEARLY', 'price_yearly')
  createLockSimulator(new Set())
})

describe('Phase 2G.5 — Tarifwechsel (Monat -> Jahr) gegen konkurrierende Kündigungen', () => {
  it('1. erfolgreicher Tarifwechsel: Guard-Zeitstempel VOR dem Stripe-Aufruf, applySubscriptionUpdated mit committedUntilMonths', async () => {
    getCurrentUserMock.mockResolvedValue(userWithActiveMonthly())
    mockClaimPreview()
    queryMock.mockResolvedValueOnce({ rowCount: 1 }) // applySubscriptionUpdated
    stripeUpdateMock.mockResolvedValue({})

    const before = new Date()
    const res = await checkout(checkoutReq())
    expect(res.status).toBe(200)

    const updateCall = queryMock.mock.calls[1]
    expect(String(updateCall[0])).toContain('subscription_state_updated_at IS NULL OR subscription_state_updated_at <')
    const guardTimestamp = updateCall[1][4] as Date // eventCreatedAt-Position in applySubscriptionUpdated()
    expect(guardTimestamp.getTime()).toBeGreaterThanOrEqual(before.getTime())
    expect(guardTimestamp.getTime()).toBeLessThanOrEqual(new Date().getTime())
  })

  it('2. Tarifwechsel konkurriert mit einer laufenden Admin-Kündigung: Tarifwechsel erhält 409, OHNE Stripe aufzurufen', async () => {
    const heldUsers = new Set<string>()
    createLockSimulator(heldUsers)
    mockAdminLookup()
    queryMock.mockResolvedValueOnce({ rowCount: 1 }) // applySubscriptionDeleted (Admin)

    const adminStripeDeferred = deferred<Record<string, never>>()
    stripeCancelMock.mockReturnValueOnce(adminStripeDeferred.promise)

    const adminPromise = adminCancelSubscription(adminReq(), { params: Promise.resolve({ id: USER_ID }) })
    await new Promise((r) => setTimeout(r, 0))
    expect(heldUsers.has(USER_ID)).toBe(true)

    getCurrentUserMock.mockResolvedValue(userWithActiveMonthly())
    const checkoutRes = await checkout(checkoutReq())
    expect(checkoutRes.status).toBe(409)
    expect(stripeUpdateMock).not.toHaveBeenCalled()

    adminStripeDeferred.resolve({})
    const adminRes = await adminPromise
    expect(adminRes.status).toBe(200)
  })

  it('3. Tarifwechsel konkurriert mit einer laufenden Jahreskündigung (cancel-yearly POST): Tarifwechsel erhält 409, OHNE Stripe aufzurufen', async () => {
    const heldUsers = new Set<string>()
    createLockSimulator(heldUsers)
    queryMock.mockResolvedValueOnce({ rowCount: 1 }) // cancel-yearly writeLocalCancelAt

    const cancelStripeDeferred = deferred<Record<string, never>>()
    stripeUpdateMock.mockReturnValueOnce(cancelStripeDeferred.promise)

    getCurrentUserMock.mockResolvedValue(
      userWithActiveMonthly({
        subscriptionTier: 'yearly',
        subscriptionCommittedUntil: '2027-01-01T00:00:00.000Z',
      })
    )
    const cancelYearlyPromise = cancelYearly()
    await new Promise((r) => setTimeout(r, 0))
    expect(heldUsers.has(USER_ID)).toBe(true)

    // Für den Tarifwechsel-Request denselben Nutzer, aber (fachlich inkonsistent, hier nur für den
    // Lock-Test relevant) mit monatlichem Bestandstarif, damit der hasActiveSub-Zweig greift.
    getCurrentUserMock.mockResolvedValue(userWithActiveMonthly())
    const checkoutRes = await checkout(checkoutReq())
    expect(checkoutRes.status).toBe(409)
    // stripeUpdateMock wurde bereits einmal von cancel-yearly selbst aufgerufen (der pendente
    // Deferred) – entscheidend ist, dass der Tarifwechsel KEINEN zusätzlichen Aufruf auslöst.
    expect(stripeUpdateMock).toHaveBeenCalledTimes(1)

    cancelStripeDeferred.resolve({})
    const cancelRes = await cancelYearlyPromise
    expect(cancelRes.status).toBe(200)
  })

  it('4. veralteter Request überschreibt keinen nachweislich neueren lokalen Zustand (Ordering-Guard, rowCount 0)', async () => {
    getCurrentUserMock.mockResolvedValue(userWithActiveMonthly())
    mockClaimPreview()
    queryMock.mockResolvedValueOnce({ rowCount: 0 }) // Guard hat den Write übersprungen
    stripeUpdateMock.mockResolvedValue({})

    const res = await checkout(checkoutReq())
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.ok).toBeUndefined()
    expect(body.stripeUpdated).toBe(true)
  })

  it('5. Stripe-Erfolg mit anschließendem DB-Fehler: ehrliche Antwort, kein irreführender Erfolg', async () => {
    getCurrentUserMock.mockResolvedValue(userWithActiveMonthly())
    mockClaimPreview()
    queryMock.mockRejectedValueOnce(new Error('DB kurzfristig nicht erreichbar'))
    stripeUpdateMock.mockResolvedValue({})

    const res = await checkout(checkoutReq())
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.ok).toBeUndefined()
    expect(body.stripeUpdated).toBe(true)
    expect(String(body.error)).not.toMatch(/erfolgreich|wurde durchgeführt/i)
  })

  it('6. Stripe-Fehler führt zu KEINER lokalen Zustandsänderung', async () => {
    getCurrentUserMock.mockResolvedValue(userWithActiveMonthly())
    mockClaimPreview()
    stripeUpdateMock.mockRejectedValue(new Error('Stripe nicht erreichbar'))

    const res = await checkout(checkoutReq())
    expect(res.status).toBe(500)
    // queryMock wurde nur für den Claim aufgerufen, NICHT für den anschließenden Write.
    expect(queryMock).toHaveBeenCalledTimes(1)
  })

  it('7a. ein zugehöriges/späteres customer.subscription.updated-Webhook-Event wird nach dem Tarifwechsel korrekt angewendet', async () => {
    const { applySubscriptionUpdated } = await import('@/lib/billing/subscription-state')
    const tierChangeGuardTimestamp = new Date('2026-02-01T10:00:00.000Z')
    queryMock.mockResolvedValueOnce({ rowCount: 1 }) // Tarifwechsel-Write
    const tierChangeApplied = await applySubscriptionUpdated(
      { query: queryMock },
      {
        userId: USER_ID,
        status: 'active',
        tier: 'yearly',
        cancelAt: null,
        committedUntilMonths: 12,
        eventCreatedAt: tierChangeGuardTimestamp,
      }
    )
    expect(tierChangeApplied).toBe(true)

    // Ein Webhook für dieselbe (oder eine spätere) Stripe-Änderung trägt ein `event.created` NACH
    // diesem Zeitpunkt – darf nicht blockiert werden.
    const laterWebhookTimestamp = new Date(tierChangeGuardTimestamp.getTime() + 1000)
    queryMock.mockResolvedValueOnce({ rowCount: 1 })
    const webhookApplied = await applySubscriptionUpdated(
      { query: queryMock },
      { userId: USER_ID, status: 'active', tier: null, cancelAt: null, eventCreatedAt: laterWebhookTimestamp }
    )
    expect(webhookApplied).toBe(true)
  })

  it('7b. ein verspätetes, ÄLTERES Webhook-Event darf den bereits vollzogenen Tarifwechsel nicht zurücksetzen', async () => {
    const { applySubscriptionUpdated } = await import('@/lib/billing/subscription-state')
    const staleWebhookTimestamp = new Date('2025-01-01T00:00:00.000Z')
    queryMock.mockResolvedValueOnce({ rowCount: 0 }) // Guard erkennt den bereits neueren Zustand

    const applied = await applySubscriptionUpdated(
      { query: queryMock },
      { userId: USER_ID, status: 'active', tier: 'monthly', cancelAt: null, eventCreatedAt: staleWebhookTimestamp }
    )
    expect(applied).toBe(false)
  })
})
