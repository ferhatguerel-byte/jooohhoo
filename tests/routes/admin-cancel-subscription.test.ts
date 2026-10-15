import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * Phase 2G.2 – eigene Testsuite für die Admin-Kündigungsroute (zuvor: keine automatisierte
 * Testabdeckung, siehe Phase-2G.1-Audit) UND für die gemeinsame Lock-/Ordering-Koordination mit
 * `cancel-yearly/route.ts`. Beide Routen werden hier zusammen importiert, damit echte
 * Lock-Konkurrenz zwischen Admin- und Nutzeraktion über denselben gemockten DB-Pool nachgebildet
 * werden kann.
 */

const {
  requireAdminApiMock,
  getCurrentUserMock,
  queryMock,
  connectMock,
  stripeCancelMock,
  stripeUpdateMock,
  logAdminActionMock,
  enqueueBillingNotificationMock,
} = vi.hoisted(() => ({
  requireAdminApiMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
  queryMock: vi.fn(),
  connectMock: vi.fn(),
  stripeCancelMock: vi.fn(),
  stripeUpdateMock: vi.fn(),
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
  getStripe: () => ({ subscriptions: { cancel: stripeCancelMock, update: stripeUpdateMock } }),
}))
vi.mock('@/lib/admin-audit', () => ({ logAdminAction: logAdminActionMock }))
vi.mock('@/lib/billing/billing-notification-outbox', () => ({ enqueueBillingNotification: enqueueBillingNotificationMock }))

import { POST as adminCancelSubscription } from '@/app/api/admin/users/[id]/cancel-subscription/route'
import { POST as cancelYearly, DELETE as undoCancelYearly } from '@/app/api/billing/cancel-yearly/route'
import { AuthorizationError } from '@/lib/authorization'

const USER_ID = '123e4567-e89b-12d3-a456-426614174000'

function adminReq() {
  return new NextRequest(`http://localhost/api/admin/users/${USER_ID}/cancel-subscription`, { method: 'POST' })
}

function callAdminCancel() {
  return adminCancelSubscription(adminReq(), { params: Promise.resolve({ id: USER_ID }) })
}

function yearlyUser(overrides: Record<string, unknown> = {}) {
  return {
    id: USER_ID,
    role: 'subunternehmer',
    accountStatus: 'active',
    subscriptionTier: 'yearly',
    stripeSubscriptionId: 'sub_1',
    subscriptionCommittedUntil: '2027-01-01T00:00:00.000Z',
    ...overrides,
  }
}

/**
 * Simuliert die Session-Advisory-Lock-Semantik von PostgreSQL (siehe
 * src/lib/billing/cancellation-lock.ts bzw. tests/routes/billing-cancel-yearly.test.ts für
 * dieselbe Simulation): `heldUsers` bildet den DB-weiten Lock-Zustand ab, unabhängig davon,
 * welche "Verbindung" ihn anfordert.
 */
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

beforeEach(() => {
  requireAdminApiMock.mockReset()
  requireAdminApiMock.mockResolvedValue({ id: 'admin-1' })
  getCurrentUserMock.mockReset()
  queryMock.mockReset()
  connectMock.mockReset()
  stripeCancelMock.mockReset()
  stripeUpdateMock.mockReset()
  logAdminActionMock.mockReset()
  enqueueBillingNotificationMock.mockReset()
  // Standard: Lock steht immer sofort zur Verfügung.
  createLockSimulator(new Set())
})

function mockUserLookup(overrides: Record<string, unknown> = {}) {
  queryMock.mockResolvedValueOnce({
    rows: [{ stripe_subscription_id: 'sub_1', subscription_status: 'active', ...overrides }],
  })
}

describe('POST /api/admin/users/[id]/cancel-subscription — Phase 2G.1/2G.2', () => {
  it('1. erfolgreiche Admin-Kündigung: Stripe gelöscht, lokale DB aktualisiert, Audit-Log geschrieben', async () => {
    mockUserLookup()
    stripeCancelMock.mockResolvedValue({})
    queryMock.mockResolvedValueOnce({ rowCount: 1 }) // applySubscriptionDeleted

    const res = await callAdminCancel()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(stripeCancelMock).toHaveBeenCalledWith('sub_1')
    expect(logAdminActionMock).toHaveBeenCalledWith(
      'admin-1',
      'SUBSCRIPTION_CHANGED',
      'user',
      USER_ID,
      { action: 'admin_canceled' },
      expect.anything()
    )
  })

  it('2. fehlende Admin-Berechtigung: kein Stripe-Aufruf, kein DB-Zugriff über den Lookup hinaus', async () => {
    requireAdminApiMock.mockRejectedValue(new AuthorizationError('Kein Zugriff.', 403))

    const res = await callAdminCancel()
    expect(res.status).toBe(403)
    expect(stripeCancelMock).not.toHaveBeenCalled()
    expect(queryMock).not.toHaveBeenCalled()
  })

  it('3. Stripe-Fehler: lokale Datenbank bleibt unverändert, kein Audit-Log', async () => {
    mockUserLookup()
    stripeCancelMock.mockRejectedValue(new Error('Stripe nicht erreichbar'))

    const res = await callAdminCancel()
    expect(res.status).toBe(500)
    // queryMock wurde nur für den initialen Lookup aufgerufen, NICHT für einen Schreibvorgang.
    expect(queryMock).toHaveBeenCalledTimes(1)
    expect(logAdminActionMock).not.toHaveBeenCalled()
  })

  it('4. DB-Fehler nach erfolgreichem Stripe-Aufruf: ehrliche Fehlerantwort, kein irreführender Erfolg', async () => {
    mockUserLookup()
    stripeCancelMock.mockResolvedValue({})
    queryMock.mockRejectedValueOnce(new Error('DB kurzfristig nicht erreichbar'))

    const res = await callAdminCancel()
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.ok).toBeUndefined()
    expect(body.stripeUpdated).toBe(true)
    expect(String(body.error)).not.toMatch(/fehlgeschlagen|nicht durchgeführt/i)
  })

  it('5. Audit-Log wird bei DB-Fehler nach Stripe-Erfolg TROTZDEM geschrieben', async () => {
    mockUserLookup()
    stripeCancelMock.mockResolvedValue({})
    queryMock.mockRejectedValueOnce(new Error('DB kurzfristig nicht erreichbar'))

    await callAdminCancel()
    expect(logAdminActionMock).toHaveBeenCalledWith(
      'admin-1',
      'SUBSCRIPTION_CHANGED',
      'user',
      USER_ID,
      { action: 'admin_canceled' },
      expect.anything()
    )
  })

  it('bereits gekündigter Nutzer: kein erneuter Stripe-Aufruf (häufigster Fall einer doppelten Admin-Anfrage)', async () => {
    mockUserLookup({ subscription_status: 'canceled' })

    const res = await callAdminCancel()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.alreadyCanceled).toBe(true)
    expect(stripeCancelMock).not.toHaveBeenCalled()
  })

  it('13a. Lock-Verbindung wird nach erfolgreicher Admin-Kündigung freigegeben', async () => {
    const createdClients = createLockSimulator(new Set())
    mockUserLookup()
    stripeCancelMock.mockResolvedValue({})
    queryMock.mockResolvedValueOnce({ rowCount: 1 })

    const res = await callAdminCancel()
    expect(res.status).toBe(200)
    expect(createdClients).toHaveLength(1)
    expect(createdClients[0].release).toHaveBeenCalledTimes(1)
  })

  it('13b. Lock-Verbindung wird auch nach einem Stripe-Fehler freigegeben', async () => {
    const createdClients = createLockSimulator(new Set())
    mockUserLookup()
    stripeCancelMock.mockRejectedValue(new Error('Stripe nicht erreichbar'))

    const res = await callAdminCancel()
    expect(res.status).toBe(500)
    expect(createdClients).toHaveLength(1)
    expect(createdClients[0].release).toHaveBeenCalledTimes(1)
  })

  it('6. zwei parallele Admin-Requests: der zweite wartet (begrenzt) auf den Lock und wird NICHT unkontrolliert parallel ausgeführt', async () => {
    const heldUsers = new Set<string>()
    createLockSimulator(heldUsers)
    mockUserLookup()
    mockUserLookup()
    queryMock.mockResolvedValue({ rowCount: 1 })

    const firstStripeDeferred = deferred<Record<string, never>>()
    let stripeCallCount = 0
    stripeCancelMock.mockImplementation(() => {
      stripeCallCount += 1
      if (stripeCallCount === 1) return firstStripeDeferred.promise
      return Promise.resolve({})
    })

    const firstReqPromise = callAdminCancel()
    // Dem ersten Request Gelegenheit geben, den Lock zu erwerben und bis zum (pendenten)
    // Stripe-Aufruf vorzudringen.
    await new Promise((r) => setTimeout(r, 0))
    expect(heldUsers.has(USER_ID)).toBe(true)

    const secondReqPromise = callAdminCancel()
    // Der zweite Request wartet (Retry-Schleife mit sehr kurzer, aber nicht sofort erschöpfter
    // Wartezeit) – er darf Stripe NICHT aufrufen, solange der erste den Lock noch hält.
    await new Promise((r) => setTimeout(r, 5))
    expect(stripeCallCount).toBe(1)

    firstStripeDeferred.resolve({})
    const [firstRes, secondRes] = await Promise.all([firstReqPromise, secondReqPromise])
    expect(firstRes.status).toBe(200)
    expect(secondRes.status).toBe(200)
    expect(stripeCallCount).toBe(2)
    expect(heldUsers.has(USER_ID)).toBe(false)
  })

  it('7. Admin-Kündigung konkurriert mit Nutzer-POST (cancel-yearly): Nutzer-Request erhält 409, OHNE Stripe aufzurufen', async () => {
    const heldUsers = new Set<string>()
    createLockSimulator(heldUsers)
    mockUserLookup()
    queryMock.mockResolvedValueOnce({ rowCount: 1 }) // applySubscriptionDeleted (Admin)

    const adminStripeDeferred = deferred<Record<string, never>>()
    stripeCancelMock.mockReturnValueOnce(adminStripeDeferred.promise)

    const adminPromise = callAdminCancel()
    await new Promise((r) => setTimeout(r, 0))
    expect(heldUsers.has(USER_ID)).toBe(true)

    getCurrentUserMock.mockResolvedValue(yearlyUser())
    const userRes = await cancelYearly()
    expect(userRes.status).toBe(409)
    expect(stripeUpdateMock).not.toHaveBeenCalled()

    adminStripeDeferred.resolve({})
    const adminRes = await adminPromise
    expect(adminRes.status).toBe(200)
  })

  it('8. Admin-Kündigung konkurriert mit Nutzer-DELETE (Rückzug): Nutzer-Request erhält 409, OHNE Stripe aufzurufen', async () => {
    const heldUsers = new Set<string>()
    createLockSimulator(heldUsers)
    mockUserLookup()
    queryMock.mockResolvedValueOnce({ rowCount: 1 }) // applySubscriptionDeleted (Admin)

    const adminStripeDeferred = deferred<Record<string, never>>()
    stripeCancelMock.mockReturnValueOnce(adminStripeDeferred.promise)

    const adminPromise = callAdminCancel()
    await new Promise((r) => setTimeout(r, 0))
    expect(heldUsers.has(USER_ID)).toBe(true)

    getCurrentUserMock.mockResolvedValue(yearlyUser())
    const userRes = await undoCancelYearly()
    expect(userRes.status).toBe(409)
    expect(stripeUpdateMock).not.toHaveBeenCalled()

    adminStripeDeferred.resolve({})
    const adminRes = await adminPromise
    expect(adminRes.status).toBe(200)
  })

  it('10. ein bereits laufender Nutzer-Request kann eine abgeschlossene Admin-Kündigung nicht nachträglich überschreiben (Ordering-Guard)', async () => {
    // Modelliert den Fall: die Nutzeraktion hatte den Lock bereits verlassen (oder nie gebraucht,
    // weil Admin ihn nach begrenzter Wartezeit ohne Lock überholt hat) und schreibt lokal MIT
    // einem Zeitstempel, der älter ist als der bereits von der Admin-Kündigung gesetzte
    // subscription_state_updated_at. Der Ordering-Guard (identisch zu applySubscriptionDeleted())
    // lässt diesen Schreibversuch 0 Zeilen treffen.
    getCurrentUserMock.mockResolvedValue(yearlyUser())
    stripeUpdateMock.mockResolvedValue({})
    queryMock.mockResolvedValueOnce({ rowCount: 0 }) // vom Ordering-Guard übersprungen

    const res = await cancelYearly()
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.ok).toBeUndefined()
    expect(body.stripeUpdated).toBe(true)
  })

  it('11. zugehöriges customer.subscription.deleted-Webhook-Event nach Admin-Kündigung wird (über dieselbe Funktion) korrekt angewendet', async () => {
    const { applySubscriptionDeleted } = await import('@/lib/billing/subscription-state')
    const adminGuardTimestamp = new Date('2026-01-01T12:00:00.000Z')
    queryMock.mockResolvedValueOnce({ rowCount: 1 }) // Admin-Schreibvorgang

    const adminApplied = await applySubscriptionDeleted({ query: queryMock }, { userId: USER_ID, eventCreatedAt: adminGuardTimestamp })
    expect(adminApplied).toBe(true)

    // Das zugehörige Webhook-Event trägt ein `event.created`, das Stripe WÄHREND der Verarbeitung
    // des Admin-Cancel-Aufrufs vergeben hat – zeitlich vor dem Admin-Guard-Zeitstempel (der NACH
    // dem Request erfasst wird) oder bestenfalls gleich; in jedem Fall darf ein tatsächlich
    // SPÄTERES, unabhängiges Webhook-Event (hier simuliert) nicht grundlos blockiert werden.
    const laterWebhookEventTimestamp = new Date(adminGuardTimestamp.getTime() + 1000)
    queryMock.mockResolvedValueOnce({ rowCount: 1 })
    const webhookApplied = await applySubscriptionDeleted(
      { query: queryMock },
      { userId: USER_ID, eventCreatedAt: laterWebhookEventTimestamp }
    )
    expect(webhookApplied).toBe(true)
  })

  it('12. verspätetes customer.subscription.updated-Event darf den endgültigen Kündigungszustand NICHT reaktivieren', async () => {
    const { applySubscriptionUpdated } = await import('@/lib/billing/subscription-state')
    // Die Admin-Kündigung hat subscription_state_updated_at bereits auf T2 gesetzt (simuliert durch
    // rowCount 0 für den nachfolgenden, ÄLTEREN Versuch).
    const staleEventTimestamp = new Date('2025-01-01T00:00:00.000Z')
    queryMock.mockResolvedValueOnce({ rowCount: 0 })

    const applied = await applySubscriptionUpdated(
      { query: queryMock },
      { userId: USER_ID, status: 'active', tier: 'yearly', cancelAt: null, eventCreatedAt: staleEventTimestamp }
    )
    expect(applied).toBe(false)
  })

  it(
    'Phase 2G.3: hält eine Nutzeraktion den Lock dauerhaft (länger als alle Admin-Versuche), erhält die Admin-Kündigung 409 statt ohne Lock fortzufahren',
    async () => {
      const heldUsers = new Set<string>([USER_ID]) // simuliert eine Nutzeraktion, die den Lock bereits hält und ihn nicht freigibt
      createLockSimulator(heldUsers)
      mockUserLookup()

      const res = await callAdminCancel()
      expect(res.status).toBe(409)
      // Entscheidend (Phase 2G.3-Korrektur): KEIN Stripe-Aufruf, wenn der Lock nicht erworben
      // werden konnte – die alte Phase-2G.2-Fassung wäre hier ungeschützt fortgefahren.
      expect(stripeCancelMock).not.toHaveBeenCalled()
      expect(logAdminActionMock).not.toHaveBeenCalled()
    },
    10_000
  )

  it('Phase 2G.3: Lock-Akquise schlägt fehl (Pool-Fehler) — kontrollierter 503, kein Stripe-Aufruf, kein unkontrollierter zweiter Versuch nötig', async () => {
    connectMock.mockRejectedValue(new Error('Pool erschöpft'))
    mockUserLookup()

    const res = await callAdminCancel()
    expect(res.status).toBe(503)
    expect(stripeCancelMock).not.toHaveBeenCalled()
  })

  it('Phase 2G.3: ein Fehler bei der Lock-FREIGABE nach erfolgreicher Kündigung verschleiert nicht das eigentliche Ergebnis', async () => {
    const heldUsers = new Set<string>()
    connectMock.mockImplementation(async () => ({
      query: vi.fn(async (sql: string, params: unknown[] = []) => {
        const userId = params[0] as string
        if (sql.includes('pg_try_advisory_lock')) {
          if (heldUsers.has(userId)) return { rows: [{ locked: false }] }
          heldUsers.add(userId)
          return { rows: [{ locked: true }] }
        }
        if (sql.includes('pg_advisory_unlock')) {
          throw new Error('Verbindung beim Freigeben verloren')
        }
        return { rows: [] }
      }),
      release: vi.fn(),
    }))
    mockUserLookup()
    stripeCancelMock.mockResolvedValue({})
    queryMock.mockResolvedValueOnce({ rowCount: 1 })

    const res = await callAdminCancel()
    // Der (best-effort abgesicherte) Fehler bei pg_advisory_unlock darf das bereits erfolgreiche
    // Ergebnis von fn() nicht verschleiern oder in einen Fehler verwandeln.
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })

  it('Phase 2G.3: nach einer kontrollierten 409-Ablehnung (Lock nicht erhalten) löst ein erneuter Admin-Versuch höchstens EINEN Stripe-Aufruf aus', async () => {
    const heldUsers = new Set<string>([USER_ID])
    createLockSimulator(heldUsers)
    mockUserLookup()
    mockUserLookup()

    const firstRes = await callAdminCancel()
    expect(firstRes.status).toBe(409)
    expect(stripeCancelMock).not.toHaveBeenCalled()

    // Die "Nutzeraktion" gibt den Lock jetzt frei (z.B. ihr eigener Request ist fertig) – ein
    // regulärer zweiter Admin-Versuch ist sicher, weil der erste NIE einen Stripe-Aufruf
    // ausgelöst hat.
    heldUsers.delete(USER_ID)
    stripeCancelMock.mockResolvedValue({})
    queryMock.mockResolvedValueOnce({ rowCount: 1 })

    const secondRes = await callAdminCancel()
    expect(secondRes.status).toBe(200)
    expect(stripeCancelMock).toHaveBeenCalledTimes(1)
  })
})
