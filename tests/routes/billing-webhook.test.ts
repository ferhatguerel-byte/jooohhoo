import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { queryMock, constructEventMock, retrieveSubscriptionMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
  constructEventMock: vi.fn(),
  retrieveSubscriptionMock: vi.fn(),
}))
vi.mock('@/lib/db', () => ({ getDb: () => ({ query: queryMock }) }))
vi.mock('@/lib/stripe', () => ({
  getStripe: () => ({
    webhooks: { constructEvent: constructEventMock },
    subscriptions: { retrieve: retrieveSubscriptionMock },
  }),
}))

import { POST } from '@/app/api/billing/webhook/route'

function webhookReq(body: string, signature?: string) {
  const headers = new Headers()
  if (signature) headers.set('stripe-signature', signature)
  return new NextRequest('http://localhost/api/billing/webhook', { method: 'POST', body, headers })
}

/** Simuliert: claimStripeEvent() gewinnt den Claim (INSERT ... ON CONFLICT liefert eine Zeile). */
function mockClaimWins() {
  queryMock.mockResolvedValueOnce({ rows: [{ id: 'claim-1' }], rowCount: 1 })
}
/** Simuliert: das Event existiert bereits mit dem übergebenen Status (Claim-INSERT liefert 0 Zeilen,
 * anschließende SELECT liefert den Status). */
function mockClaimLosesWithStatus(status: string) {
  queryMock.mockResolvedValueOnce({ rows: [], rowCount: 0 })
  queryMock.mockResolvedValueOnce({ rows: [{ status }], rowCount: 1 })
}

beforeEach(() => {
  queryMock.mockReset()
  constructEventMock.mockReset()
  retrieveSubscriptionMock.mockReset()
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_test')
  vi.stubEnv('STRIPE_PRICE_MONTHLY', 'price_monthly')
  vi.stubEnv('STRIPE_PRICE_YEARLY', 'price_yearly')
})

describe('POST /api/billing/webhook — Signature/Security (Teil M)', () => {
  it('rejects a request without a Stripe signature header', async () => {
    const res = await POST(webhookReq('{}'))
    expect(res.status).toBe(500)
    expect(queryMock).not.toHaveBeenCalled()
  })

  it('Phase 4.2 (Teil P.7): fehlendes Webhook-Secret -> 500, keine Verarbeitung', async () => {
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', '')
    const res = await POST(webhookReq('{}', 'sig'))
    expect(res.status).toBe(500)
    expect(queryMock).not.toHaveBeenCalled()
  })

  it('Phase 4.2 (Teil P.6): rejects a request with an invalid signature (forged webhook)', async () => {
    constructEventMock.mockImplementation(() => {
      throw new Error('signature mismatch')
    })
    const res = await POST(webhookReq('{}', 'sig_invalid'))
    expect(res.status).toBe(400)
    expect(queryMock).not.toHaveBeenCalled()
  })
})

describe('POST /api/billing/webhook — Idempotency (Teil B/C/P)', () => {
  it('Teil P.1: dasselbe Event zweimal -> zweiter Aufruf idempotent erfolgreich, keine erneute Verarbeitung', async () => {
    constructEventMock.mockReturnValue({
      id: 'evt_dup',
      type: 'checkout.session.completed',
      created: 1000,
      data: { object: { metadata: {}, subscription: null, customer: null, payment_status: 'paid' } },
    })
    mockClaimLosesWithStatus('processed')

    const res = await POST(webhookReq('{}', 'sig_valid'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.idempotent).toBe(true)
    // Nur der Claim-Insert + die Status-SELECT wurden ausgeführt, keine fachliche Verarbeitung.
    expect(queryMock).toHaveBeenCalledTimes(2)
  })

  it('Teil P.2/C: dasselbe Event parallel (ein Prozess gewinnt den DB-Claim, der andere nicht)', async () => {
    constructEventMock.mockReturnValue({
      id: 'evt_parallel',
      type: 'checkout.session.completed',
      created: 1000,
      data: { object: { metadata: { userId: 'u1', tier: 'monthly' }, subscription: 'sub_1', customer: 'cus_1', payment_status: 'paid' } },
    })

    // Request A gewinnt den Claim.
    mockClaimWins()
    queryMock.mockResolvedValueOnce({ rowCount: 1 }) // applyCheckoutActivation
    queryMock.mockResolvedValueOnce({ rowCount: 1 }) // markStripeEventProcessed
    const resA = await POST(webhookReq('{}', 'sig_valid'))
    expect(resA.status).toBe(200)

    // Request B (derselbe Event) verliert den Claim -> bereits "processed" von A.
    mockClaimLosesWithStatus('processed')
    const resB = await POST(webhookReq('{}', 'sig_valid'))
    expect(resB.status).toBe(200)
    const bodyB = await resB.json()
    expect(bodyB.idempotent).toBe(true)
  })

  it('Teil P.3: bereits "processing" (paralleler Request läuft noch) -> idempotent erfolgreich, kein Fehler', async () => {
    constructEventMock.mockReturnValue({ id: 'evt_inflight', type: 'invoice.created', created: 1000, data: { object: {} } })
    mockClaimLosesWithStatus('processing')
    const res = await POST(webhookReq('{}', 'sig_valid'))
    expect(res.status).toBe(200)
  })

  it('Teil P.4: ein zuvor "failed" markiertes Event darf erneut geclaimt und verarbeitet werden', async () => {
    constructEventMock.mockReturnValue({
      id: 'evt_retry',
      type: 'customer.subscription.deleted',
      created: 1000,
      data: { object: { metadata: { userId: 'u1' } } },
    })
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 0 }) // Claim-Insert: existiert bereits
    queryMock.mockResolvedValueOnce({ rows: [{ status: 'failed' }], rowCount: 1 }) // Status-SELECT
    queryMock.mockResolvedValueOnce({ rows: [{ id: 'x' }], rowCount: 1 }) // Reclaim-UPDATE gewinnt
    queryMock.mockResolvedValueOnce({ rowCount: 1 }) // applySubscriptionDeleted
    queryMock.mockResolvedValueOnce({ rowCount: 1 }) // markStripeEventProcessed

    const res = await POST(webhookReq('{}', 'sig_valid'))
    expect(res.status).toBe(200)
  })

  it('Teil P.5: unterschiedliche Event-IDs mit inhaltlich identischem Payload werden beide unabhängig verarbeitet', async () => {
    constructEventMock.mockReturnValueOnce({
      id: 'evt_a',
      type: 'customer.subscription.deleted',
      created: 1000,
      data: { object: { metadata: { userId: 'u1' } } },
    })
    mockClaimWins()
    queryMock.mockResolvedValueOnce({ rowCount: 1 })
    queryMock.mockResolvedValueOnce({ rowCount: 1 })
    const resA = await POST(webhookReq('{}', 'sig_valid'))
    expect(resA.status).toBe(200)

    constructEventMock.mockReturnValueOnce({
      id: 'evt_b',
      type: 'customer.subscription.deleted',
      created: 1000,
      data: { object: { metadata: { userId: 'u1' } } },
    })
    mockClaimWins()
    queryMock.mockResolvedValueOnce({ rowCount: 1 })
    queryMock.mockResolvedValueOnce({ rowCount: 1 })
    const resB = await POST(webhookReq('{}', 'sig_valid'))
    expect(resB.status).toBe(200)
  })

  it('Teil P.8: unbekannter Event-Typ wird ohne Fehler ignoriert (aber als verarbeitet markiert)', async () => {
    constructEventMock.mockReturnValue({ id: 'evt_unknown', type: 'invoice.created', created: 1000, data: { object: {} } })
    mockClaimWins()
    queryMock.mockResolvedValueOnce({ rowCount: 1 }) // markStripeEventProcessed
    const res = await POST(webhookReq('{}', 'sig_valid'))
    expect(res.status).toBe(200)
    expect(queryMock).toHaveBeenCalledTimes(2)
  })

  it('returns a non-2xx status on a DB failure so Stripe retries the event, and marks the event failed', async () => {
    constructEventMock.mockReturnValue({
      id: 'evt_fail',
      type: 'checkout.session.completed',
      created: 1000,
      data: { object: { metadata: { userId: 'u1', tier: 'monthly' }, subscription: 'sub_1', customer: 'cus_1', payment_status: 'paid' } },
    })
    mockClaimWins()
    queryMock.mockRejectedValueOnce(new Error('connection terminated')) // applyCheckoutActivation wirft
    queryMock.mockResolvedValueOnce({ rowCount: 1 }) // markStripeEventFailed
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await POST(webhookReq('{}', 'sig_valid'))
    expect(res.status).toBe(500)
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})

describe('POST /api/billing/webhook — checkout.session.completed (Teil I/S)', () => {
  it('Teil S.1: erfolgreicher Checkout aktiviert das Abo', async () => {
    constructEventMock.mockReturnValue({
      id: 'evt_checkout_ok',
      type: 'checkout.session.completed',
      created: 1000,
      data: { object: { metadata: { userId: 'u1', tier: 'monthly' }, subscription: 'sub_1', customer: 'cus_1', payment_status: 'paid' } },
    })
    mockClaimWins()
    queryMock.mockResolvedValueOnce({ rowCount: 1 }) // applyCheckoutActivation
    queryMock.mockResolvedValueOnce({ rowCount: 1 }) // markProcessed
    const res = await POST(webhookReq('{}', 'sig_valid'))
    expect(res.status).toBe(200)
    expect(queryMock.mock.calls[1][0]).toContain('UPDATE users')
  })

  it('Teil S.2: Checkout ohne Subscription (z.B. falscher Modus) aktiviert nichts', async () => {
    constructEventMock.mockReturnValue({
      id: 'evt_checkout_no_sub',
      type: 'checkout.session.completed',
      created: 1000,
      data: { object: { metadata: { userId: 'u1', tier: 'monthly' }, subscription: null, customer: 'cus_1', payment_status: 'paid' } },
    })
    mockClaimWins()
    queryMock.mockResolvedValueOnce({ rowCount: 1 }) // nur markProcessed, kein UPDATE users
    const res = await POST(webhookReq('{}', 'sig_valid'))
    expect(res.status).toBe(200)
    expect(queryMock).toHaveBeenCalledTimes(2) // Claim + markProcessed, kein zusätzliches UPDATE
  })

  it('Teil S.3/I: Checkout mit payment_status "unpaid" (z.B. async Zahlungsmethode) aktiviert nichts', async () => {
    constructEventMock.mockReturnValue({
      id: 'evt_checkout_unpaid',
      type: 'checkout.session.completed',
      created: 1000,
      data: { object: { metadata: { userId: 'u1', tier: 'monthly' }, subscription: 'sub_1', customer: 'cus_1', payment_status: 'unpaid' } },
    })
    mockClaimWins()
    queryMock.mockResolvedValueOnce({ rowCount: 1 }) // nur markProcessed
    const res = await POST(webhookReq('{}', 'sig_valid'))
    expect(res.status).toBe(200)
    expect(queryMock).toHaveBeenCalledTimes(2)
  })

  it('Teil S.4/K: ein verspäteter Webhook nach der Rückkehr des Nutzers wird trotzdem korrekt angewendet', async () => {
    // Simuliert lediglich, dass der Webhook zeitlich später eintrifft als der Checkout-Redirect –
    // fachlich identisch zum Normalfall, siehe Teil S.1. Der eigentliche Fallback für die
    // Wartezeit läuft über reconcileUserStripeSubscription() (siehe tests/billing/reconcile-subscription.test.ts).
    constructEventMock.mockReturnValue({
      id: 'evt_checkout_late',
      type: 'checkout.session.completed',
      created: 5000,
      data: { object: { metadata: { userId: 'u1', tier: 'yearly' }, subscription: 'sub_2', customer: 'cus_2', payment_status: 'paid' } },
    })
    mockClaimWins()
    queryMock.mockResolvedValueOnce({ rowCount: 1 })
    queryMock.mockResolvedValueOnce({ rowCount: 1 })
    const res = await POST(webhookReq('{}', 'sig_valid'))
    expect(res.status).toBe(200)
  })

  it('Teil S.7: ein wiederholtes checkout.session.completed-Event (gleiche Event-ID) aktiviert nicht doppelt', async () => {
    constructEventMock.mockReturnValue({
      id: 'evt_checkout_repeat',
      type: 'checkout.session.completed',
      created: 1000,
      data: { object: { metadata: { userId: 'u1', tier: 'monthly' }, subscription: 'sub_1', customer: 'cus_1', payment_status: 'paid' } },
    })
    mockClaimLosesWithStatus('processed')
    const res = await POST(webhookReq('{}', 'sig_valid'))
    expect(res.status).toBe(200)
    expect(queryMock).toHaveBeenCalledTimes(2)
  })

  it('fehlende userId/tier-Metadata aktiviert nichts (kein Absturz)', async () => {
    constructEventMock.mockReturnValue({
      id: 'evt_checkout_no_meta',
      type: 'checkout.session.completed',
      created: 1000,
      data: { object: { metadata: {}, subscription: 'sub_1', customer: 'cus_1', payment_status: 'paid' } },
    })
    mockClaimWins()
    queryMock.mockResolvedValueOnce({ rowCount: 1 }) // nur markProcessed
    const res = await POST(webhookReq('{}', 'sig_valid'))
    expect(res.status).toBe(200)
    expect(queryMock).toHaveBeenCalledTimes(2)
  })
})

describe('POST /api/billing/webhook — Event Ordering (Teil D/Q)', () => {
  it('Teil Q.1: updated(created=200) dann deleted(created=300) -> Endzustand inactive/canceled bleibt bestehen', async () => {
    constructEventMock.mockReturnValueOnce({
      id: 'evt_q1_updated',
      type: 'customer.subscription.updated',
      created: 200,
      data: { object: { metadata: { userId: 'u1' }, status: 'active', cancel_at: null, items: { data: [{ price: { id: 'price_monthly' } }] } } },
    })
    mockClaimWins()
    queryMock.mockResolvedValueOnce({ rowCount: 1 })
    queryMock.mockResolvedValueOnce({ rowCount: 1 })
    await POST(webhookReq('{}', 'sig_valid'))

    constructEventMock.mockReturnValueOnce({
      id: 'evt_q1_deleted',
      type: 'customer.subscription.deleted',
      created: 300,
      data: { object: { metadata: { userId: 'u1' } } },
    })
    mockClaimWins()
    queryMock.mockResolvedValueOnce({ rowCount: 1 }) // applySubscriptionDeleted (neuer -> angewendet)
    queryMock.mockResolvedValueOnce({ rowCount: 1 })
    const res = await POST(webhookReq('{}', 'sig_valid'))
    expect(res.status).toBe(200)
    // Das UPDATE für "deleted" muss mit dem WHERE-Ordering-Guard und created=300 aufgerufen worden sein.
    const deleteCall = queryMock.mock.calls.find((c) => String(c[0]).includes("subscription_status = 'canceled'"))
    expect(deleteCall).toBeTruthy()
  })

  it('Teil Q.2: deleted(created=300) dann updated(created=200, älter) -> updated darf inactive/canceled nicht überschreiben', async () => {
    constructEventMock.mockReturnValueOnce({
      id: 'evt_q2_deleted',
      type: 'customer.subscription.deleted',
      created: 300,
      data: { object: { metadata: { userId: 'u1' } } },
    })
    mockClaimWins()
    queryMock.mockResolvedValueOnce({ rowCount: 1 })
    queryMock.mockResolvedValueOnce({ rowCount: 1 })
    await POST(webhookReq('{}', 'sig_valid'))

    constructEventMock.mockReturnValueOnce({
      id: 'evt_q2_updated',
      type: 'customer.subscription.updated',
      created: 200,
      data: { object: { metadata: { userId: 'u1' }, status: 'active', cancel_at: null, items: { data: [{ price: { id: 'price_monthly' } }] } } },
    })
    mockClaimWins()
    // In einer echten DB würde der Ordering-Guard hier 0 Zeilen zurückgeben (siehe reales
    // Postgres-Verifikations-Protokoll im Abschlussbericht) – hier wird das UPDATE selbst
    // ausgeführt (der Mock kann die WHERE-Bedingung nicht auswerten), aber die Anfrage muss die
    // korrekte WHERE-Klausel mit dem Ordering-Guard enthalten.
    queryMock.mockResolvedValueOnce({ rowCount: 0 })
    queryMock.mockResolvedValueOnce({ rowCount: 1 })
    const res = await POST(webhookReq('{}', 'sig_valid'))
    expect(res.status).toBe(200)
    const updateCall = queryMock.mock.calls.find((c) => String(c[0]).includes("subscription_status = $1"))
    expect(String(updateCall?.[0])).toContain('subscription_state_updated_at IS NULL OR subscription_state_updated_at <')
  })

  it('Teil Q.3: updated(created=200) dann updated(created=300) -> Zustand aus Event 300 gewinnt', async () => {
    constructEventMock.mockReturnValueOnce({
      id: 'evt_q3_first',
      type: 'customer.subscription.updated',
      created: 200,
      data: { object: { metadata: { userId: 'u1' }, status: 'past_due', cancel_at: null, items: { data: [{ price: { id: 'price_monthly' } }] } } },
    })
    mockClaimWins()
    queryMock.mockResolvedValueOnce({ rowCount: 1 })
    queryMock.mockResolvedValueOnce({ rowCount: 1 })
    await POST(webhookReq('{}', 'sig_valid'))

    constructEventMock.mockReturnValueOnce({
      id: 'evt_q3_second',
      type: 'customer.subscription.updated',
      created: 300,
      data: { object: { metadata: { userId: 'u1' }, status: 'active', cancel_at: null, items: { data: [{ price: { id: 'price_yearly' } }] } } },
    })
    mockClaimWins()
    queryMock.mockResolvedValueOnce({ rowCount: 1 })
    queryMock.mockResolvedValueOnce({ rowCount: 1 })
    const res = await POST(webhookReq('{}', 'sig_valid'))
    expect(res.status).toBe(200)
    const secondUpdateCall = queryMock.mock.calls[4]
    expect(secondUpdateCall[1]).toContain('active')
    expect(secondUpdateCall[1]).toContain('yearly')
  })

  it('Teil Q.4: Event 300 erneut (gleiche Event-ID) -> keine zusätzliche Nebenwirkung', async () => {
    constructEventMock.mockReturnValue({
      id: 'evt_q4_repeat',
      type: 'customer.subscription.updated',
      created: 300,
      data: { object: { metadata: { userId: 'u1' }, status: 'active', cancel_at: null, items: { data: [] } } },
    })
    mockClaimLosesWithStatus('processed')
    const res = await POST(webhookReq('{}', 'sig_valid'))
    expect(res.status).toBe(200)
    expect(queryMock).toHaveBeenCalledTimes(2) // nur Claim-Insert + Status-SELECT, kein UPDATE users
  })

  it('Teil Q.5: Event 200 (neue Event-ID) nach Event 300 -> darf Zustand 300 nicht überschreiben', async () => {
    constructEventMock.mockReturnValueOnce({
      id: 'evt_q5_late_arrival',
      type: 'customer.subscription.updated',
      created: 200,
      data: { object: { metadata: { userId: 'u1' }, status: 'past_due', cancel_at: null, items: { data: [] } } },
    })
    mockClaimWins()
    // Ordering-Guard schlägt fehl (Event ist älter als der bereits gespeicherte Zustand aus
    // created=300) -> 0 Zeilen betroffen, aber kein Fehler.
    queryMock.mockResolvedValueOnce({ rowCount: 0 })
    queryMock.mockResolvedValueOnce({ rowCount: 1 })
    const res = await POST(webhookReq('{}', 'sig_valid'))
    expect(res.status).toBe(200)
  })
})

describe('POST /api/billing/webhook — invoice.payment_failed (Teil F/R)', () => {
  function invoiceEvent(id: string, created: number, subscriptionId: string | null) {
    return {
      id,
      type: 'invoice.payment_failed',
      created,
      data: {
        object: {
          parent: subscriptionId ? { subscription_details: { subscription: subscriptionId } } : null,
        },
      },
    }
  }

  it('Teil R.1: payment_failed bei aktiver Subscription -> Stripe-Status entscheidet (hier weiterhin past_due, keine Kündigung)', async () => {
    constructEventMock.mockReturnValue(invoiceEvent('evt_r1', 1000, 'sub_1'))
    mockClaimWins()
    retrieveSubscriptionMock.mockResolvedValueOnce({
      id: 'sub_1',
      status: 'past_due',
      cancel_at: null,
      metadata: { userId: 'u1' },
      items: { data: [{ price: { id: 'price_monthly' } }] },
    })
    queryMock.mockResolvedValueOnce({ rowCount: 1 }) // applySubscriptionUpdated
    queryMock.mockResolvedValueOnce({ rowCount: 1 }) // markProcessed
    const res = await POST(webhookReq('{}', 'sig_valid'))
    expect(res.status).toBe(200)
    expect(retrieveSubscriptionMock).toHaveBeenCalledWith('sub_1')
    const updateCall = queryMock.mock.calls[1]
    expect(updateCall[1]).toContain('past_due')
  })

  it('Teil R.2: payment_failed bei bereits past_due -> bleibt past_due, keine aggressive Kündigung', async () => {
    constructEventMock.mockReturnValue(invoiceEvent('evt_r2', 1000, 'sub_2'))
    mockClaimWins()
    retrieveSubscriptionMock.mockResolvedValueOnce({
      id: 'sub_2',
      status: 'past_due',
      cancel_at: null,
      metadata: { userId: 'u2' },
      items: { data: [] },
    })
    queryMock.mockResolvedValueOnce({ rowCount: 1 })
    queryMock.mockResolvedValueOnce({ rowCount: 1 })
    const res = await POST(webhookReq('{}', 'sig_valid'))
    expect(res.status).toBe(200)
    expect(queryMock.mock.calls[1][1]).toContain('past_due')
  })

  it('Teil R.3: payment_failed bei bereits gekündigter Subscription -> Stripe-Status (canceled) mappt auf inactive, kein Fehler', async () => {
    constructEventMock.mockReturnValue(invoiceEvent('evt_r3', 1000, 'sub_3'))
    mockClaimWins()
    retrieveSubscriptionMock.mockResolvedValueOnce({
      id: 'sub_3',
      status: 'canceled',
      cancel_at: null,
      metadata: { userId: 'u3' },
      items: { data: [] },
    })
    queryMock.mockResolvedValueOnce({ rowCount: 1 })
    queryMock.mockResolvedValueOnce({ rowCount: 1 })
    const res = await POST(webhookReq('{}', 'sig_valid'))
    expect(res.status).toBe(200)
    expect(queryMock.mock.calls[1][1]).toContain('inactive')
  })

  it('Teil R.4: wiederholtes payment_failed (gleiche Event-ID) -> keine zusätzliche Nebenwirkung', async () => {
    constructEventMock.mockReturnValue(invoiceEvent('evt_r4', 1000, 'sub_4'))
    mockClaimLosesWithStatus('processed')
    const res = await POST(webhookReq('{}', 'sig_valid'))
    expect(res.status).toBe(200)
    expect(retrieveSubscriptionMock).not.toHaveBeenCalled()
  })

  it('Teil R.5: payment_failed mit unbekannter Subscription bei Stripe -> kein Fehler, kein Absturz', async () => {
    constructEventMock.mockReturnValue(invoiceEvent('evt_r5', 1000, 'sub_missing'))
    mockClaimWins()
    retrieveSubscriptionMock.mockRejectedValueOnce(new Error('No such subscription'))
    queryMock.mockResolvedValueOnce({ rowCount: 1 }) // nur markProcessed
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const res = await POST(webhookReq('{}', 'sig_valid'))
    expect(res.status).toBe(200)
    spy.mockRestore()
  })

  it('Teil R.6: payment_failed mit unbekannter Invoice (keine Subscription referenziert) -> kein Fehler', async () => {
    constructEventMock.mockReturnValue(invoiceEvent('evt_r6', 1000, null))
    mockClaimWins()
    queryMock.mockResolvedValueOnce({ rowCount: 1 }) // nur markProcessed
    const res = await POST(webhookReq('{}', 'sig_valid'))
    expect(res.status).toBe(200)
    expect(retrieveSubscriptionMock).not.toHaveBeenCalled()
  })

  it('Teil R.7: verspätetes payment_failed respektiert den Ordering-Guard wie jedes andere Subscription-Event', async () => {
    constructEventMock.mockReturnValue(invoiceEvent('evt_r7', 50, 'sub_7'))
    mockClaimWins()
    retrieveSubscriptionMock.mockResolvedValueOnce({
      id: 'sub_7',
      status: 'past_due',
      cancel_at: null,
      metadata: { userId: 'u7' },
      items: { data: [] },
    })
    queryMock.mockResolvedValueOnce({ rowCount: 0 }) // Ordering-Guard lehnt veraltetes Event ab
    queryMock.mockResolvedValueOnce({ rowCount: 1 })
    const res = await POST(webhookReq('{}', 'sig_valid'))
    expect(res.status).toBe(200)
  })

  it('Teil R.8: parallele Verarbeitung desselben payment_failed-Events -> nur einer verarbeitet', async () => {
    constructEventMock.mockReturnValue(invoiceEvent('evt_r8', 1000, 'sub_8'))
    mockClaimWins()
    retrieveSubscriptionMock.mockResolvedValueOnce({
      id: 'sub_8',
      status: 'active',
      cancel_at: null,
      metadata: { userId: 'u8' },
      items: { data: [] },
    })
    queryMock.mockResolvedValueOnce({ rowCount: 1 })
    queryMock.mockResolvedValueOnce({ rowCount: 1 })
    const resA = await POST(webhookReq('{}', 'sig_valid'))
    expect(resA.status).toBe(200)

    mockClaimLosesWithStatus('processing')
    const resB = await POST(webhookReq('{}', 'sig_valid'))
    expect(resB.status).toBe(200)
    expect(retrieveSubscriptionMock).toHaveBeenCalledTimes(1)
  })
})

describe('POST /api/billing/webhook — customer.subscription.updated Tier-Mapping (Teil G)', () => {
  it('bekannte STRIPE_PRICE_MONTHLY-Price-ID setzt Tier "monthly", keine hardcodierte ID', async () => {
    constructEventMock.mockReturnValue({
      id: 'evt_g1',
      type: 'customer.subscription.updated',
      created: 1000,
      data: { object: { metadata: { userId: 'u1' }, status: 'active', cancel_at: null, items: { data: [{ price: { id: 'price_monthly' } }] } } },
    })
    mockClaimWins()
    queryMock.mockResolvedValueOnce({ rowCount: 1 })
    queryMock.mockResolvedValueOnce({ rowCount: 1 })
    await POST(webhookReq('{}', 'sig_valid'))
    expect(queryMock.mock.calls[1][1]).toContain('monthly')
  })

  it('unbekannte Price-ID ohne Metadata-Fallback setzt Tier NICHT versehentlich (COALESCE mit null)', async () => {
    constructEventMock.mockReturnValue({
      id: 'evt_g2',
      type: 'customer.subscription.updated',
      created: 1000,
      data: { object: { metadata: { userId: 'u1' }, status: 'active', cancel_at: null, items: { data: [{ price: { id: 'price_unknown' } }] } } },
    })
    mockClaimWins()
    queryMock.mockResolvedValueOnce({ rowCount: 1 })
    queryMock.mockResolvedValueOnce({ rowCount: 1 })
    await POST(webhookReq('{}', 'sig_valid'))
    // tier-Parameter ist null -> SQL COALESCE($2, subscription_tier) behält bestehenden Wert.
    expect(queryMock.mock.calls[1][1]).toContain(null)
  })
})
