import { describe, it, expect, vi, beforeEach } from 'vitest'

const queryMock = vi.fn()
vi.mock('@/lib/db', () => ({ getDb: () => ({ query: queryMock }) }))

import { checkRateLimit, enforceRateLimit, RateLimitError, getClientIp } from '@/lib/rate-limit'
import { NextRequest } from 'next/server'

describe('checkRateLimit', () => {
  beforeEach(() => {
    queryMock.mockReset()
    // Das beiläufige Aufräumen alter Einträge wird zufällig (5% Chance) ausgelöst; für
    // deterministische Tests hier standardmäßig deaktiviert, außer wo explizit getestet.
    vi.spyOn(Math, 'random').mockReturnValue(0.9)
  })

  it('allows the request and records a hit when under the limit', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ count: 2 }] }) // COUNT
    queryMock.mockResolvedValueOnce({}) // INSERT

    const allowed = await checkRateLimit('test-bucket', 'user-1', 5, 60)

    expect(allowed).toBe(true)
    expect(queryMock).toHaveBeenCalledTimes(2)
    expect(queryMock.mock.calls[1][0]).toMatch(/INSERT INTO rate_limit_hits/)
  })

  it('denies the request once the limit is reached, without recording another hit', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ count: 5 }] })

    const allowed = await checkRateLimit('test-bucket', 'user-1', 5, 60)

    expect(allowed).toBe(false)
    // Nur die COUNT-Abfrage, kein zusätzlicher INSERT für die geblockte Aktion.
    expect(queryMock).toHaveBeenCalledTimes(1)
  })

  it('occasionally cleans up old entries without affecting the result', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.01)
    queryMock.mockResolvedValueOnce({ rows: [{ count: 0 }] }) // COUNT
    queryMock.mockResolvedValueOnce({}) // INSERT
    queryMock.mockResolvedValueOnce({}) // DELETE (Cleanup)

    const allowed = await checkRateLimit('test-bucket', 'user-1', 5, 60)

    expect(allowed).toBe(true)
    expect(queryMock.mock.calls[2][0]).toMatch(/DELETE FROM rate_limit_hits/)
  })
})

describe('enforceRateLimit', () => {
  beforeEach(() => {
    queryMock.mockReset()
  })

  it('throws RateLimitError (-> 429 via handleApiError) once the limit is exceeded', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ count: 99 }] })
    await expect(enforceRateLimit('bucket', 'id', 10, 60)).rejects.toBeInstanceOf(RateLimitError)
  })

  it('does not throw while still under the limit', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ count: 0 }] })
    queryMock.mockResolvedValue({}) // INSERT + ggf. das beiläufige Cleanup (zufällig ausgelöst)
    await expect(enforceRateLimit('bucket', 'id', 10, 60)).resolves.toBeUndefined()
  })
})

describe('getClientIp', () => {
  it('prefers x-forwarded-for and takes the first entry', () => {
    const req = new NextRequest('http://localhost/api/test', {
      headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
    })
    expect(getClientIp(req)).toBe('1.2.3.4')
  })

  it('falls back to x-real-ip, then "unknown"', () => {
    const withRealIp = new NextRequest('http://localhost/api/test', { headers: { 'x-real-ip': '9.9.9.9' } })
    expect(getClientIp(withRealIp)).toBe('9.9.9.9')

    const withNoHeaders = new NextRequest('http://localhost/api/test')
    expect(getClientIp(withNoHeaders)).toBe('unknown')
  })
})
