import { describe, it, expect, vi, beforeEach } from 'vitest'

const { connectMock } = vi.hoisted(() => ({ connectMock: vi.fn() }))
vi.mock('@/lib/db', () => ({ getDb: () => ({ connect: connectMock }) }))

import {
  withYearlyCancellationLock,
  withAdminCancellationPriorityLock,
  LOCK_UNAVAILABLE,
  LOCK_SETUP_FAILED,
} from '@/lib/billing/cancellation-lock'

function makeClient(lockResponses: boolean[]) {
  let call = 0
  const query = vi.fn(async (sql: string, params: unknown[] = []) => {
    if (sql.includes('pg_try_advisory_lock')) {
      expect(params[0]).toBeTruthy() // userId wird bei jedem Lock-Versuch mitgegeben
      const locked = lockResponses[Math.min(call, lockResponses.length - 1)]
      call += 1
      return { rows: [{ locked }] }
    }
    if (sql.includes('pg_advisory_unlock')) {
      return { rows: [{ unlocked: true }] }
    }
    return { rows: [] }
  })
  const release = vi.fn()
  return { query, release }
}

beforeEach(() => {
  connectMock.mockReset()
})

describe('withYearlyCancellationLock — Phase 2F.2 (Regressionsschutz nach Phase 2G.2-Refactor)', () => {
  it('führt fn() aus und gibt den Lock danach frei, wenn der Lock sofort verfügbar ist', async () => {
    const client = makeClient([true])
    connectMock.mockResolvedValue(client)

    const result = await withYearlyCancellationLock('u1', async () => 'done')
    expect(result).toBe('done')
    expect(client.release).toHaveBeenCalledTimes(1)
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining('pg_advisory_unlock'), ['u1', expect.any(Number)])
  })

  it('gibt LOCK_UNAVAILABLE zurück und ruft fn() NICHT auf, wenn der Lock bereits belegt ist', async () => {
    const client = makeClient([false])
    connectMock.mockResolvedValue(client)
    const fn = vi.fn()

    const result = await withYearlyCancellationLock('u1', fn)
    expect(result).toBe(LOCK_UNAVAILABLE)
    expect(fn).not.toHaveBeenCalled()
  })

  it('gibt LOCK_SETUP_FAILED zurück, wenn keine dedizierte Verbindung aufgebaut werden kann', async () => {
    connectMock.mockRejectedValue(new Error('Pool erschöpft'))
    const fn = vi.fn()

    const result = await withYearlyCancellationLock('u1', fn)
    expect(result).toBe(LOCK_SETUP_FAILED)
    expect(fn).not.toHaveBeenCalled()
  })

  it('gibt den Lock auch frei, wenn fn() wirft, und reicht den Fehler unverändert weiter', async () => {
    const client = makeClient([true])
    connectMock.mockResolvedValue(client)

    await expect(withYearlyCancellationLock('u1', () => Promise.reject(new Error('boom')))).rejects.toThrow('boom')
    expect(client.release).toHaveBeenCalledTimes(1)
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining('pg_advisory_unlock'), ['u1', expect.any(Number)])
  })
})

describe('withAdminCancellationPriorityLock — Phase 2G.2 (Admin-Vorrang)', () => {
  it('nutzt denselben Lock-Schlüssel (hashtextextended mit identischem Seed) wie withYearlyCancellationLock', async () => {
    const client = makeClient([true])
    connectMock.mockResolvedValue(client)

    await withAdminCancellationPriorityLock('u1', async () => 'ok')
    const lockCall = client.query.mock.calls.find((c) => String(c[0]).includes('pg_try_advisory_lock'))
    expect(lockCall?.[1]).toEqual(['u1', expect.any(Number)])

    connectMock.mockReset()
    const client2 = makeClient([true])
    connectMock.mockResolvedValue(client2)
    await withYearlyCancellationLock('u1', async () => 'ok')
    const lockCall2 = client2.query.mock.calls.find((c) => String(c[0]).includes('pg_try_advisory_lock'))

    // Derselbe Seed-Parameter in beiden Aufrufen -> identischer Lock-Key für denselben userId.
    expect(lockCall?.[1]?.[1]).toBe(lockCall2?.[1]?.[1])
  })

  it('erhält den Lock sofort und führt fn() lock-geschützt aus, wenn er sofort verfügbar ist', async () => {
    const client = makeClient([true])
    connectMock.mockResolvedValue(client)

    const result = await withAdminCancellationPriorityLock('u1', async () => 'admin-done', {
      retryAttempts: 3,
      retryDelayMs: 1,
    })
    expect(result).toBe('admin-done')
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining('pg_advisory_unlock'), ['u1', expect.any(Number)])
    expect(client.release).toHaveBeenCalledTimes(1)
  })

  it('wiederholt den Versuch bei belegtem Lock und erhält ihn, sobald er innerhalb der Wartezeit frei wird', async () => {
    // Erster Versuch: belegt. Zweiter Versuch: frei.
    const client = makeClient([false, true])
    connectMock.mockResolvedValue(client)

    const result = await withAdminCancellationPriorityLock('u1', async () => 'acquired-on-retry', {
      retryAttempts: 3,
      retryDelayMs: 1,
    })
    expect(result).toBe('acquired-on-retry')
    const lockAttempts = client.query.mock.calls.filter((c) => String(c[0]).includes('pg_try_advisory_lock'))
    expect(lockAttempts).toHaveLength(2)
    // Lock wurde tatsächlich erworben (zweiter Versuch erfolgreich) -> muss auch wieder
    // freigegeben werden.
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining('pg_advisory_unlock'), ['u1', expect.any(Number)])
  })

  it('Phase 2G.3: gibt nach Ausschöpfen aller Versuche LOCK_UNAVAILABLE zurück — fn() wird NIEMALS ohne den Lock aufgerufen', async () => {
    const client = makeClient([false, false, false])
    connectMock.mockResolvedValue(client)
    const fn = vi.fn().mockResolvedValue('should-never-run')

    const result = await withAdminCancellationPriorityLock('u1', fn, { retryAttempts: 3, retryDelayMs: 1 })
    expect(result).toBe(LOCK_UNAVAILABLE)
    expect(fn).not.toHaveBeenCalled()
    // Lock wurde nie erworben -> kein pg_advisory_unlock-Aufruf nötig/erwartet.
    expect(client.query).not.toHaveBeenCalledWith(expect.stringContaining('pg_advisory_unlock'), expect.anything())
    const lockAttempts = client.query.mock.calls.filter((c) => String(c[0]).includes('pg_try_advisory_lock'))
    expect(lockAttempts).toHaveLength(3)
  })

  it('Phase 2G.3: ein zweiter, unkontrollierter Versuch nach LOCK_UNAVAILABLE löst keinen doppelten Stripe-Aufruf aus, weil fn() beim ersten Versuch nie lief', async () => {
    const client = makeClient([false])
    connectMock.mockResolvedValue(client)
    const fn = vi.fn().mockResolvedValue('stripe-call-result')

    const firstResult = await withAdminCancellationPriorityLock('u1', fn, { retryAttempts: 1, retryDelayMs: 1 })
    expect(firstResult).toBe(LOCK_UNAVAILABLE)
    expect(fn).not.toHaveBeenCalled()

    // Ein regulärer, erneuter Versuch (z.B. der Admin klickt nach der 409-Antwort erneut) ist
    // sicher: der erste, fehlgeschlagene Versuch hat fn() nie ausgeführt, es gibt also keinen
    // bereits erfolgten Stripe-Aufruf, der durch diesen zweiten Versuch verdoppelt werden könnte.
    const client2 = makeClient([true])
    connectMock.mockResolvedValue(client2)
    const secondResult = await withAdminCancellationPriorityLock('u1', fn, { retryAttempts: 1, retryDelayMs: 1 })
    expect(secondResult).toBe('stripe-call-result')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('Phase 2G.3: ein Fehler beim Lock-Erwerb selbst (z.B. Verbindungsproblem) führt zu LOCK_SETUP_FAILED statt zu einem Fortfahren ohne Lock', async () => {
    const client = {
      query: vi.fn().mockRejectedValue(new Error('Verbindung während der Lock-Abfrage verloren')),
      release: vi.fn(),
    }
    connectMock.mockResolvedValue(client)
    const fn = vi.fn()

    const result = await withAdminCancellationPriorityLock('u1', fn, { retryAttempts: 3, retryDelayMs: 1 })
    expect(result).toBe(LOCK_SETUP_FAILED)
    expect(fn).not.toHaveBeenCalled()
    expect(client.release).toHaveBeenCalledTimes(1)
  })

  it('gibt LOCK_SETUP_FAILED zurück und ruft fn() NICHT auf, wenn keine dedizierte Verbindung aufgebaut werden kann', async () => {
    connectMock.mockRejectedValue(new Error('Pool erschöpft'))
    const fn = vi.fn()

    const result = await withAdminCancellationPriorityLock('u1', fn, { retryAttempts: 3, retryDelayMs: 1 })
    expect(result).toBe(LOCK_SETUP_FAILED)
    expect(fn).not.toHaveBeenCalled()
  })

  it('gibt die dedizierte Verbindung in jedem Fall frei (Erfolg, Fehler in fn(), Lock nie erhalten)', async () => {
    const successClient = makeClient([true])
    connectMock.mockResolvedValueOnce(successClient)
    await withAdminCancellationPriorityLock('u1', async () => 'ok', { retryAttempts: 1, retryDelayMs: 1 })
    expect(successClient.release).toHaveBeenCalledTimes(1)

    const errorClient = makeClient([true])
    connectMock.mockResolvedValueOnce(errorClient)
    await expect(
      withAdminCancellationPriorityLock('u2', () => Promise.reject(new Error('stripe boom')), {
        retryAttempts: 1,
        retryDelayMs: 1,
      })
    ).rejects.toThrow('stripe boom')
    expect(errorClient.release).toHaveBeenCalledTimes(1)

    const unavailableClient = makeClient([false])
    connectMock.mockResolvedValueOnce(unavailableClient)
    await withAdminCancellationPriorityLock('u3', async () => 'proceeded', { retryAttempts: 1, retryDelayMs: 1 })
    expect(unavailableClient.release).toHaveBeenCalledTimes(1)
  })
})
