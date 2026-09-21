import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { queryMock, verifyPasswordMock, hashPasswordMock, createSessionCookieMock, hashResetTokenMock } = vi.hoisted(
  () => ({
    queryMock: vi.fn(),
    verifyPasswordMock: vi.fn(),
    hashPasswordMock: vi.fn(async () => 'hashed'),
    createSessionCookieMock: vi.fn(),
    hashResetTokenMock: vi.fn((t: string) => `hash(${t})`),
  })
)
vi.mock('@/lib/db', () => ({ getDb: () => ({ query: queryMock }) }))
vi.mock('@/lib/auth', () => ({
  verifyPassword: verifyPasswordMock,
  hashPassword: hashPasswordMock,
  createSessionCookie: createSessionCookieMock,
  hashResetToken: hashResetTokenMock,
}))

import { POST as login } from '@/app/api/auth/login/route'
import { POST as register } from '@/app/api/auth/register/route'
import { POST as resetPassword } from '@/app/api/auth/reset-password/route'

function jsonReq(url: string, body: unknown) {
  return new NextRequest(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

beforeEach(() => {
  // Das beiläufige, zufällig ausgelöste Aufräumen alter Rate-Limit-Einträge (5% Chance) soll
  // die exakt vorgegebenen Mock-Antwortsequenzen in diesen Tests nicht durcheinanderbringen.
  vi.spyOn(Math, 'random').mockReturnValue(0.9)
})

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    queryMock.mockReset()
    verifyPasswordMock.mockReset()
  })

  it('rejects wrong credentials with a generic message (no user enumeration)', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ count: 0 }] }) // Rate-Limit COUNT
    queryMock.mockResolvedValueOnce({}) // Rate-Limit INSERT
    queryMock.mockResolvedValueOnce({ rows: [] }) // kein User gefunden
    const res = await login(jsonReq('http://localhost/api/auth/login', { email: 'x@example.com', password: 'wrong' }))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('E-Mail oder Passwort ist falsch.')
  })

  it('rejects a suspended account even with the correct password', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ count: 0 }] })
    queryMock.mockResolvedValueOnce({})
    queryMock.mockResolvedValueOnce({
      rows: [{ id: 'u1', role: 'auftraggeber', password_hash: 'h', account_status: 'suspended' }],
    })
    verifyPasswordMock.mockResolvedValue(true)
    const res = await login(jsonReq('http://localhost/api/auth/login', { email: 'x@example.com', password: 'right' }))
    expect(res.status).toBe(403)
  })

  it('enforces the login rate limit (brute-force protection)', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ count: 999 }] }) // Limit bereits erreicht
    const res = await login(jsonReq('http://localhost/api/auth/login', { email: 'x@example.com', password: 'guess' }))
    expect(res.status).toBe(429)
  })

  it('logs in successfully with correct credentials on an active account', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ count: 0 }] })
    queryMock.mockResolvedValueOnce({})
    queryMock.mockResolvedValueOnce({
      rows: [{ id: 'u1', role: 'auftraggeber', password_hash: 'h', account_status: 'active' }],
    })
    verifyPasswordMock.mockResolvedValue(true)
    const res = await login(jsonReq('http://localhost/api/auth/login', { email: 'x@example.com', password: 'right' }))
    expect(res.status).toBe(200)
    expect(createSessionCookieMock).toHaveBeenCalledWith({ userId: 'u1', role: 'auftraggeber' })
  })
})

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    queryMock.mockReset()
  })

  it('rejects registration with an already-used email', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ count: 0 }] }) // Rate-Limit COUNT
    queryMock.mockResolvedValueOnce({}) // Rate-Limit INSERT
    queryMock.mockResolvedValueOnce({ rows: [{ id: 'existing' }] }) // E-Mail existiert bereits

    const res = await register(
      jsonReq('http://localhost/api/auth/register', {
        email: 'taken@example.com',
        password: 'supersecret',
        role: 'auftraggeber',
        companyName: 'Test GmbH',
        plz: '10115',
        ort: 'Berlin',
      })
    )
    expect(res.status).toBe(409)
  })

  it('Phase 4.1: lehnt einen zu langen Firmennamen ab (>150 Zeichen), Zod validiert vor jedem DB-Zugriff', async () => {
    const res = await register(
      jsonReq('http://localhost/api/auth/register', {
        email: 'neu@example.com',
        password: 'supersecret',
        role: 'auftraggeber',
        companyName: 'A'.repeat(151),
        plz: '10115',
        ort: 'Berlin',
      })
    )
    expect(res.status).toBe(400)
    // Zod wirft vor dem Rate-Limit-Check/DB-Zugriff (siehe route.ts: registerSchema.parse() zuerst).
    expect(queryMock).not.toHaveBeenCalled()
  })

  it('Phase 4.1: akzeptiert einen Firmennamen an der exakten Grenze (150 Zeichen)', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ count: 0 }] }) // Rate-Limit COUNT
    queryMock.mockResolvedValueOnce({}) // Rate-Limit INSERT
    queryMock.mockResolvedValueOnce({ rows: [] }) // E-Mail noch nicht vergeben
    queryMock.mockResolvedValueOnce({ rows: [{ id: 'new-user' }] }) // INSERT users

    const res = await register(
      jsonReq('http://localhost/api/auth/register', {
        email: 'grenzfall@example.com',
        password: 'supersecret',
        role: 'auftraggeber',
        companyName: 'A'.repeat(150),
        plz: '10115',
        ort: 'Berlin',
      })
    )
    expect(res.status).not.toBe(400)
  })
})

describe('POST /api/auth/reset-password', () => {
  beforeEach(() => {
    queryMock.mockReset()
  })

  it('rejects an invalid or expired token', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] })
    const res = await resetPassword(
      jsonReq('http://localhost/api/auth/reset-password', { token: 'bad-token', password: 'newpassword123' })
    )
    expect(res.status).toBe(400)
  })

  it('resets the password for a valid token and marks the token as used', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: 'token-1', user_id: 'u1' }] })
    queryMock.mockResolvedValueOnce({}) // UPDATE users
    queryMock.mockResolvedValueOnce({}) // UPDATE password_reset_tokens

    const res = await resetPassword(
      jsonReq('http://localhost/api/auth/reset-password', { token: 'good-token', password: 'newpassword123' })
    )
    expect(res.status).toBe(200)
    expect(queryMock).toHaveBeenCalledTimes(3)
  })
})
