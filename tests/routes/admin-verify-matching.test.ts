import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { requireAdminApiMock, queryMock, logAdminActionMock, matchProviderAgainstOpenJobsMock } = vi.hoisted(() => ({
  requireAdminApiMock: vi.fn(),
  queryMock: vi.fn(),
  logAdminActionMock: vi.fn(),
  matchProviderAgainstOpenJobsMock: vi.fn(),
}))
vi.mock('@/lib/authorization', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  requireAdminApi: requireAdminApiMock,
}))
vi.mock('@/lib/db', () => ({ getDb: () => ({ query: queryMock }) }))
vi.mock('@/lib/admin-audit', () => ({ logAdminAction: logAdminActionMock }))
vi.mock('@/lib/matching/run-provider-matching', () => ({ matchProviderAgainstOpenJobs: matchProviderAgainstOpenJobsMock }))

import { POST } from '@/app/api/admin/verify/route'
import { AuthorizationError } from '@/lib/authorization'

function req(body: unknown) {
  return new NextRequest('http://localhost/api/admin/verify', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

describe('POST /api/admin/verify — Matching-Lifecycle Phase C (Re-Matching bei Verifizierung)', () => {
  beforeEach(() => {
    requireAdminApiMock.mockReset()
    requireAdminApiMock.mockResolvedValue({ id: 'admin-1' })
    queryMock.mockReset()
    queryMock.mockResolvedValue({ rows: [] })
    logAdminActionMock.mockReset()
    matchProviderAgainstOpenJobsMock.mockReset()
    matchProviderAgainstOpenJobsMock.mockResolvedValue({ providerId: '123e4567-e89b-12d3-a456-426614174000', resultCount: 0, eligibleCount: 0, excludedCount: 0 })
  })

  it('status=verified löst matchProviderAgainstOpenJobs für den betroffenen Provider aus', async () => {
    const res = await POST(req({ userId: '123e4567-e89b-12d3-a456-426614174000', status: 'verified', verifiedGewerke: ['Elektro'] }))
    expect(res.status).toBe(200)
    expect(matchProviderAgainstOpenJobsMock).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174000')
  })

  it('status=rejected löst KEIN Re-Matching aus', async () => {
    const res = await POST(req({ userId: '123e4567-e89b-12d3-a456-426614174000', status: 'rejected' }))
    expect(res.status).toBe(200)
    expect(matchProviderAgainstOpenJobsMock).not.toHaveBeenCalled()
  })

  it('status=unverified löst KEIN Re-Matching aus', async () => {
    const res = await POST(req({ userId: '123e4567-e89b-12d3-a456-426614174000', status: 'unverified' }))
    expect(res.status).toBe(200)
    expect(matchProviderAgainstOpenJobsMock).not.toHaveBeenCalled()
  })

  it('ein Fehler im Re-Matching lässt die Verifizierung trotzdem erfolgreich zurückkehren (isoliert)', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    matchProviderAgainstOpenJobsMock.mockRejectedValueOnce(new Error('Matching-DB down'))
    const res = await POST(req({ userId: '123e4567-e89b-12d3-a456-426614174000', status: 'verified', verifiedGewerke: ['Elektro'] }))
    expect(res.status).toBe(200)
    consoleErrorSpy.mockRestore()
  })

  it('ohne Admin-Rechte wird weder die Verifizierung noch ein Re-Matching ausgeführt', async () => {
    requireAdminApiMock.mockRejectedValue(new AuthorizationError('Kein Zugriff.'))
    const res = await POST(req({ userId: '123e4567-e89b-12d3-a456-426614174000', status: 'verified' }))
    expect(res.status).toBe(403)
    expect(matchProviderAgainstOpenJobsMock).not.toHaveBeenCalled()
  })
})
