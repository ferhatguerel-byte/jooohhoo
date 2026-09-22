import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const queryMock = vi.fn()
vi.mock('@/lib/db', () => ({ getDb: () => ({ query: queryMock }) }))
vi.mock('@/lib/auth', () => ({
  hashPassword: vi.fn(async () => 'hashed'),
  hashResetToken: (t: string) => `hash(${t})`,
}))

import { POST } from '@/app/api/auth/reset-password/route'

function req(body: unknown, ip = '1.2.3.4') {
  return new NextRequest('http://localhost/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
  })
}

describe('POST /api/auth/reset-password — Phase 4.3 Rate Limit (Teil 5: Passwort-Reset-Abuse)', () => {
  beforeEach(() => {
    queryMock.mockReset()
    vi.spyOn(Math, 'random').mockReturnValue(0.9)
  })

  it('lehnt weitere Versuche von derselben IP ab, sobald das Limit (10/Stunde) erreicht ist (429)', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ count: 10 }] })
    const res = await POST(req({ token: 'guess-1', password: 'newpassword123' }))
    expect(res.status).toBe(429)
    // Kein Token-Lookup, sobald das Limit erreicht ist.
    expect(queryMock).toHaveBeenCalledTimes(1)
  })

  it('unterschiedliche IPs haben unabhängige Limits', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ count: 10 }] }) // IP A am Limit
    const resA = await POST(req({ token: 'guess-1', password: 'newpassword123' }, '1.1.1.1'))
    expect(resA.status).toBe(429)

    queryMock.mockResolvedValueOnce({ rows: [{ count: 0 }] }) // IP B unbelastet
    queryMock.mockResolvedValueOnce({})
    queryMock.mockResolvedValueOnce({ rows: [] }) // Token ungültig -> 400, aber nicht 429
    const resB = await POST(req({ token: 'guess-2', password: 'newpassword123' }, '2.2.2.2'))
    expect(resB.status).toBe(400)
  })

  it('erlaubt Token-Einlösung unterhalb des Limits', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ count: 0 }] })
    queryMock.mockResolvedValueOnce({})
    queryMock.mockResolvedValueOnce({ rows: [{ id: 'token-1', user_id: 'u1' }] })
    queryMock.mockResolvedValueOnce({})
    queryMock.mockResolvedValueOnce({})
    const res = await POST(req({ token: 'good-token', password: 'newpassword123' }))
    expect(res.status).toBe(200)
  })
})
