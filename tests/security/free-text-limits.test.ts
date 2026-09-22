import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { queryMock, getCurrentUserMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
}))
vi.mock('@/lib/db', () => ({ getDb: () => ({ query: queryMock }) }))
vi.mock('@/lib/current-user', () => ({ getCurrentUser: getCurrentUserMock }))
vi.mock('@/lib/auth', () => ({
  hashPassword: vi.fn(async () => 'hashed'),
  createSessionCookie: vi.fn(),
}))

import { POST as register } from '@/app/api/auth/register/route'
import { POST as updateProfile } from '@/app/api/profile/route'

function jsonReq(url: string, body: unknown) {
  return new NextRequest(url, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })
}

describe('POST /api/auth/register — Phase 4.3 (Teil D: Free-Text-Limits)', () => {
  beforeEach(() => {
    queryMock.mockReset()
    vi.spyOn(Math, 'random').mockReturnValue(0.9)
  })

  const validBody = {
    email: 'neu@example.com',
    password: 'supersecret',
    role: 'auftraggeber' as const,
    companyName: 'Test GmbH',
    plz: '10115',
    ort: 'Berlin',
  }

  it('lehnt eine Telefonnummer über 30 Zeichen ab', async () => {
    const res = await register(jsonReq('http://localhost/api/auth/register', { ...validBody, phone: '0'.repeat(31) }))
    expect(res.status).toBe(400)
    expect(queryMock).not.toHaveBeenCalled()
  })

  it('lehnt eine PLZ über 10 Zeichen ab', async () => {
    const res = await register(jsonReq('http://localhost/api/auth/register', { ...validBody, plz: '1'.repeat(11) }))
    expect(res.status).toBe(400)
  })

  it('lehnt einen Ort über 100 Zeichen ab', async () => {
    const res = await register(jsonReq('http://localhost/api/auth/register', { ...validBody, ort: 'A'.repeat(101) }))
    expect(res.status).toBe(400)
  })

  it('akzeptiert gültige Werte an der Grenze', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ count: 0 }] }) // Rate-Limit COUNT
    queryMock.mockResolvedValueOnce({}) // Rate-Limit INSERT
    queryMock.mockResolvedValueOnce({ rows: [] }) // E-Mail noch nicht vergeben
    queryMock.mockResolvedValueOnce({ rows: [{ id: 'new-user', role: 'auftraggeber' }] })
    const res = await register(
      jsonReq('http://localhost/api/auth/register', { ...validBody, phone: '0'.repeat(30), plz: '1'.repeat(10), ort: 'A'.repeat(100) })
    )
    expect(res.status).not.toBe(400)
  })
})

describe('POST /api/profile — Phase 4.3 (Teil D: Free-Text-Limits)', () => {
  const baseUser = {
    id: 'u1',
    role: 'auftraggeber' as const,
    verificationStatus: 'unverified' as const,
    blockedGewerke: [] as string[],
    qualificationFiles: [] as { fileId: string; name: string; label: string }[],
  }

  beforeEach(() => {
    queryMock.mockReset()
    getCurrentUserMock.mockReset()
    getCurrentUserMock.mockResolvedValue(baseUser)
    queryMock.mockResolvedValue({ rows: [{ count: 0 }] })
  })

  function profileReq(body: unknown) {
    return jsonReq('http://localhost/api/profile', body)
  }

  it('lehnt eine Telefonnummer über 30 Zeichen ab', async () => {
    const res = await updateProfile(profileReq({ companyName: 'Test GmbH', plz: '10115', ort: 'Berlin', phone: '0'.repeat(31) }))
    expect(res.status).toBe(400)
  })

  it('lehnt eine PLZ über 10 Zeichen ab', async () => {
    const res = await updateProfile(profileReq({ companyName: 'Test GmbH', plz: '1'.repeat(11), ort: 'Berlin' }))
    expect(res.status).toBe(400)
  })

  it('lehnt einen Ort über 100 Zeichen ab', async () => {
    const res = await updateProfile(profileReq({ companyName: 'Test GmbH', plz: '10115', ort: 'A'.repeat(101) }))
    expect(res.status).toBe(400)
  })
})
