import { describe, it, expect, vi, beforeEach } from 'vitest'

const { getCurrentUserMock, queryMock, connectMock, subscriptionsUpdateMock, enqueueBillingNotificationMock } = vi.hoisted(() => ({
  getCurrentUserMock: vi.fn(),
  queryMock: vi.fn(),
  connectMock: vi.fn(),
  subscriptionsUpdateMock: vi.fn(),
  enqueueBillingNotificationMock: vi.fn(),
}))
vi.mock('@/lib/current-user', () => ({ getCurrentUser: getCurrentUserMock }))
vi.mock('@/lib/db', () => ({ getDb: () => ({ query: queryMock, connect: connectMock }) }))
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

/**
 * Simuliert die Session-Advisory-Lock-Semantik von PostgreSQL für `withYearlyCancellationLock()`
 * (siehe src/lib/billing/cancellation-lock.ts): `heldUsers` bildet den DB-weiten Lock-Zustand ab
 * (ein Lock-Key kann global nur von EINER Session gleichzeitig gehalten werden, unabhängig davon,
 * welche "Verbindung" ihn anfordert) – nicht pro erzeugtem Mock-Client, genau wie bei einer
 * echten PostgreSQL-Datenbank.
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
  let reject!: (err: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

beforeEach(() => {
  getCurrentUserMock.mockReset()
  queryMock.mockReset()
  connectMock.mockReset()
  subscriptionsUpdateMock.mockReset()
  enqueueBillingNotificationMock.mockReset()
  // Standard: Lock steht immer sofort zur Verfügung, jeder connect()-Aufruf liefert einen frischen
  // Client. Tests, die echte Lock-Konkurrenz prüfen, überschreiben dies gezielt via
  // createLockSimulator().
  createLockSimulator(new Set())
})

describe('POST /api/billing/cancel-yearly — Kündigungsbestätigung (Phase 2B, Aufgabe 2 / Phase 2F.2)', () => {
  it('reicht eine Kündigungsbestätigung in der Outbox ein, NACHDEM Stripe + lokale DB bereits aktualisiert wurden', async () => {
    getCurrentUserMock.mockResolvedValue(yearlyUser())
    subscriptionsUpdateMock.mockResolvedValue({})
    queryMock.mockResolvedValueOnce({ rowCount: 1 }) // UPDATE users SET subscription_cancel_at

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
    queryMock.mockResolvedValueOnce({ rowCount: 1 })
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
    queryMock.mockResolvedValue({ rowCount: 1 })

    await POST()
    await POST()

    const keys = enqueueBillingNotificationMock.mock.calls.map((c) => c[0].dedupeKey)
    expect(keys[0]).toBe(keys[1])
  })

  it('Phase 2F.2: Stripe-Fehler führt zu KEINER lokalen Zustandsänderung (kein DB-Write, kein Outbox-Eintrag)', async () => {
    getCurrentUserMock.mockResolvedValue(yearlyUser())
    subscriptionsUpdateMock.mockRejectedValue(new Error('Stripe nicht erreichbar'))

    const res = await POST()
    expect(res.status).toBe(500)
    expect(queryMock).not.toHaveBeenCalled()
    expect(enqueueBillingNotificationMock).not.toHaveBeenCalled()
  })

  it('Phase 2F.2: erfolgreicher Retry nach einem zuvor fehlgeschlagenen Stripe-Aufruf', async () => {
    getCurrentUserMock.mockResolvedValue(yearlyUser())
    subscriptionsUpdateMock.mockRejectedValueOnce(new Error('Stripe nicht erreichbar'))
    subscriptionsUpdateMock.mockResolvedValueOnce({})
    queryMock.mockResolvedValueOnce({ rowCount: 1 })

    const firstRes = await POST()
    expect(firstRes.status).toBe(500)

    // Der Lock aus dem fehlgeschlagenen ersten Versuch muss zuverlässig freigegeben worden sein –
    // sonst würde dieser zweite, an sich erfolgreiche Versuch fälschlich mit 409 blockiert.
    const secondRes = await POST()
    expect(secondRes.status).toBe(200)
    expect(subscriptionsUpdateMock).toHaveBeenCalledTimes(2)
    expect(queryMock).toHaveBeenCalledTimes(1)
  })

  it('Phase 2F.2: DB-Fehler NACH erfolgreichem Stripe-Aufruf meldet KEINEN irreführenden Erfolg', async () => {
    getCurrentUserMock.mockResolvedValue(yearlyUser())
    subscriptionsUpdateMock.mockResolvedValue({})
    queryMock.mockRejectedValueOnce(new Error('DB kurzfristig nicht erreichbar'))

    const res = await POST()
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.ok).toBeUndefined()
    expect(body.stripeUpdated).toBe(true)
    expect(String(body.error)).not.toMatch(/erfolgreich|wurde eingereicht/i)
    // Ohne gesicherten lokalen Schreibvorgang darf keine Bestätigungsmail eingereiht werden.
    expect(enqueueBillingNotificationMock).not.toHaveBeenCalled()
  })

  it('Phase 2F.2: der Guard-Zeitstempel wird VOR dem Stripe-Aufruf erfasst, damit ein verzögertes Webhook-Event für dieselbe Änderung niemals fälschlich als veraltet gilt', async () => {
    getCurrentUserMock.mockResolvedValue(yearlyUser())
    const stripeDeferred = deferred<Record<string, never>>()
    subscriptionsUpdateMock.mockReturnValue(stripeDeferred.promise)
    queryMock.mockResolvedValueOnce({ rowCount: 1 })

    const before = new Date()
    const resPromise = POST()
    // Stripe antwortet erst nach einer künstlichen Verzögerung – der Guard-Zeitstempel darf nicht
    // erst NACH dieser Verzögerung erfasst werden, sonst könnte ein zugehöriges, später
    // eintreffendes Webhook-Event für dieselbe Änderung fälschlich als veraltet gelten.
    await new Promise((r) => setTimeout(r, 20))
    const stripeRespondsAt = new Date()
    stripeDeferred.resolve({})
    const res = await resPromise
    expect(res.status).toBe(200)

    const updateCall = queryMock.mock.calls[0]
    const guardTimestamp = updateCall[1][1] as Date
    expect(guardTimestamp.getTime()).toBeGreaterThanOrEqual(before.getTime())
    expect(guardTimestamp.getTime()).toBeLessThan(stripeRespondsAt.getTime())
  })

  it('Phase 2F.2: ein per Ordering-Guard nachweislich neuerer lokaler Zustand wird NICHT überschrieben, aber auch nicht als sicherer Erfolg gemeldet', async () => {
    getCurrentUserMock.mockResolvedValue(yearlyUser())
    subscriptionsUpdateMock.mockResolvedValue({})
    // rowCount 0 = UPDATE hat keine Zeile getroffen, weil der Guard eine bereits neuere
    // subscription_state_updated_at (z.B. durch einen nahezu gleichzeitigen Webhook) erkannt hat.
    queryMock.mockResolvedValueOnce({ rowCount: 0 })

    const res = await POST()
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.stripeUpdated).toBe(true)
    expect(enqueueBillingNotificationMock).not.toHaveBeenCalled()
  })
})

describe('DELETE /api/billing/cancel-yearly', () => {
  it('zieht eine Kündigung zurück, ohne eine zusätzliche Bestätigungs-E-Mail auszulösen (nicht Teil des beauftragten Umfangs)', async () => {
    getCurrentUserMock.mockResolvedValue(yearlyUser())
    subscriptionsUpdateMock.mockResolvedValue({})
    queryMock.mockResolvedValueOnce({ rowCount: 1 })

    const res = await DELETE()
    expect(res.status).toBe(200)
    expect(enqueueBillingNotificationMock).not.toHaveBeenCalled()
  })

  it('Phase 2F.2: Stripe-Fehler führt zu keiner lokalen Zustandsänderung', async () => {
    getCurrentUserMock.mockResolvedValue(yearlyUser())
    subscriptionsUpdateMock.mockRejectedValue(new Error('Stripe nicht erreichbar'))

    const res = await DELETE()
    expect(res.status).toBe(500)
    expect(queryMock).not.toHaveBeenCalled()
  })
})

describe('Phase 2F.2 — Serialisierung paralleler Kündigungs-Requests (Advisory Lock)', () => {
  it('paralleles POST/DELETE für DENSELBEN Nutzer: der zweite, sich überschneidende Request erhält 409 — niemals ein zweiter Stripe-Aufruf während der erste noch läuft', async () => {
    getCurrentUserMock.mockResolvedValue(yearlyUser())
    const heldUsers = new Set<string>()
    createLockSimulator(heldUsers)

    const stripeDeferred = deferred<Record<string, never>>()
    subscriptionsUpdateMock.mockReturnValueOnce(stripeDeferred.promise)
    queryMock.mockResolvedValueOnce({ rowCount: 1 })

    const postPromise = POST()
    // Dem Event-Loop Gelegenheit geben, bis zum (pendenten) Stripe-Aufruf von POST vorzudringen –
    // der Lock für 'u1' ist an dieser Stelle bereits gehalten.
    await Promise.resolve()
    await Promise.resolve()

    const deleteRes = await DELETE()
    expect(deleteRes.status).toBe(409)
    // Entscheidend: DELETE wurde durch den Lock abgewiesen, BEVOR es Stripe überhaupt erreicht hat.
    expect(subscriptionsUpdateMock).toHaveBeenCalledTimes(1)

    stripeDeferred.resolve({})
    const postRes = await postPromise
    expect(postRes.status).toBe(200)
    expect(heldUsers.has('u1')).toBe(false) // Lock wurde nach Abschluss wieder freigegeben.
  })

  it('parallele Requests verschiedener Nutzer blockieren sich nicht gegenseitig', async () => {
    const heldUsers = new Set<string>()
    createLockSimulator(heldUsers)
    subscriptionsUpdateMock.mockResolvedValue({})
    queryMock.mockResolvedValue({ rowCount: 1 })

    getCurrentUserMock.mockResolvedValueOnce(yearlyUser({ id: 'u1' }))
    const resA = await POST()
    getCurrentUserMock.mockResolvedValueOnce(yearlyUser({ id: 'u2' }))
    const resB = await POST()

    expect(resA.status).toBe(200)
    expect(resB.status).toBe(200)
    expect(subscriptionsUpdateMock).toHaveBeenCalledTimes(2)
  })

  it('Lock nicht verfügbar: gibt sofort 409 zurück, OHNE Stripe aufzurufen', async () => {
    getCurrentUserMock.mockResolvedValue(yearlyUser())
    connectMock.mockResolvedValue({
      query: vi.fn().mockResolvedValue({ rows: [{ locked: false }] }),
      release: vi.fn(),
    })

    const res = await POST()
    expect(res.status).toBe(409)
    expect(subscriptionsUpdateMock).not.toHaveBeenCalled()
    expect(queryMock).not.toHaveBeenCalled()
  })

  it('Lock-Verbindung nicht verfügbar (Pool-Fehler): gibt 503 zurück, OHNE Stripe aufzurufen', async () => {
    getCurrentUserMock.mockResolvedValue(yearlyUser())
    connectMock.mockRejectedValue(new Error('Pool erschöpft'))

    const res = await POST()
    expect(res.status).toBe(503)
    expect(subscriptionsUpdateMock).not.toHaveBeenCalled()
  })

  it('die dedizierte Lock-Verbindung wird nach einem erfolgreichen Request zuverlässig freigegeben', async () => {
    getCurrentUserMock.mockResolvedValue(yearlyUser())
    const createdClients = createLockSimulator(new Set())
    subscriptionsUpdateMock.mockResolvedValue({})
    queryMock.mockResolvedValueOnce({ rowCount: 1 })

    const res = await POST()
    expect(res.status).toBe(200)
    expect(createdClients).toHaveLength(1)
    expect(createdClients[0].release).toHaveBeenCalledTimes(1)
  })

  it('die dedizierte Lock-Verbindung wird auch nach einem fehlgeschlagenen Request (Stripe-Fehler) zuverlässig freigegeben', async () => {
    getCurrentUserMock.mockResolvedValue(yearlyUser())
    const createdClients = createLockSimulator(new Set())
    subscriptionsUpdateMock.mockRejectedValue(new Error('Stripe nicht erreichbar'))

    const res = await POST()
    expect(res.status).toBe(500)
    expect(createdClients).toHaveLength(1)
    expect(createdClients[0].release).toHaveBeenCalledTimes(1)
  })
})
