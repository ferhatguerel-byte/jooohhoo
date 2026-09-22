import { describe, it, expect, vi, beforeEach } from 'vitest'

const queryMock = vi.fn()
vi.mock('@/lib/db', () => ({ getDb: () => ({ query: queryMock }) }))

import { rateLimit } from '@/lib/security/rate-limit'
import { RateLimitError } from '@/lib/rate-limit'

describe('rateLimit — Phase 4.3 (Teil B) zentrale Fassade', () => {
  beforeEach(() => {
    queryMock.mockReset()
    vi.spyOn(Math, 'random').mockReturnValue(0.9)
  })

  it('erlaubt die Aktion unterhalb des Limits und wirft nicht', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ count: 0 }] })
    queryMock.mockResolvedValueOnce({})
    await expect(rateLimit({ key: 'jobs-create:user-1', limit: 10, windowSeconds: 3600 })).resolves.toBeUndefined()
  })

  it('wirft RateLimitError, sobald das Limit erreicht ist', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ count: 10 }] })
    await expect(rateLimit({ key: 'jobs-create:user-1', limit: 10, windowSeconds: 3600 })).rejects.toBeInstanceOf(
      RateLimitError
    )
  })

  it('zerlegt den key an der ersten ":" in bucket/identifier für die zugrunde liegende Tabelle', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ count: 0 }] })
    queryMock.mockResolvedValueOnce({})
    await rateLimit({ key: 'support-ticket-create:user-42', limit: 5, windowSeconds: 3600 })
    const [bucket, identifier] = queryMock.mock.calls[0][1]
    expect(bucket).toBe('support-ticket-create')
    expect(identifier).toBe('user-42')
  })

  it('ein key ohne ":" wird für Bucket UND Identifier verwendet', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ count: 0 }] })
    queryMock.mockResolvedValueOnce({})
    await rateLimit({ key: 'global-bucket', limit: 5, windowSeconds: 3600 })
    const [bucket, identifier] = queryMock.mock.calls[0][1]
    expect(bucket).toBe('global-bucket')
    expect(identifier).toBe('global-bucket')
  })

  it('rundet windowSeconds < 60 auf 1 Minute auf (DB-Granularität)', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ count: 0 }] })
    queryMock.mockResolvedValueOnce({})
    await rateLimit({ key: 'offer-messages:user-1', limit: 20, windowSeconds: 30 })
    const [, , windowMinutes] = queryMock.mock.calls[0][1]
    expect(windowMinutes).toBe(1)
  })

  it('windowSeconds=300 wird zu 5 Minuten', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ count: 0 }] })
    queryMock.mockResolvedValueOnce({})
    await rateLimit({ key: 'offer-messages:user-1', limit: 20, windowSeconds: 300 })
    const [, , windowMinutes] = queryMock.mock.calls[0][1]
    expect(windowMinutes).toBe(5)
  })

  it('gibt eine benutzerdefinierte Nachricht an RateLimitError weiter', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ count: 999 }] })
    await expect(
      rateLimit({ key: 'jobs-create:user-1', limit: 10, windowSeconds: 3600, message: 'Zu viele Aufträge.' })
    ).rejects.toThrow('Zu viele Aufträge.')
  })
})
