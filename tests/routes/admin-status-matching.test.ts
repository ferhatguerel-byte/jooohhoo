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

import { POST } from '@/app/api/admin/users/[id]/status/route'

function req(body: unknown) {
  return new NextRequest('http://localhost/api/admin/users/sub-1/status', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

describe('POST /api/admin/users/[id]/status — Matching-Lifecycle Phase C (Re-Matching bei Reaktivierung)', () => {
  beforeEach(() => {
    requireAdminApiMock.mockReset()
    requireAdminApiMock.mockResolvedValue({ id: 'admin-1' })
    queryMock.mockReset()
    queryMock.mockResolvedValue({ rows: [] })
    logAdminActionMock.mockReset()
    matchProviderAgainstOpenJobsMock.mockReset()
    matchProviderAgainstOpenJobsMock.mockResolvedValue({ providerId: 'sub-1', resultCount: 0, eligibleCount: 0, excludedCount: 0 })
  })

  it('Reaktivierung (status=active) löst matchProviderAgainstOpenJobs für den betroffenen Provider aus', async () => {
    const res = await POST(req({ status: 'active' }), { params: Promise.resolve({ id: 'sub-1' }) })
    expect(res.status).toBe(200)
    expect(matchProviderAgainstOpenJobsMock).toHaveBeenCalledWith('sub-1')
  })

  it('Sperrung (status=suspended) löst KEIN Re-Matching aus', async () => {
    const res = await POST(req({ status: 'suspended' }), { params: Promise.resolve({ id: 'sub-1' }) })
    expect(res.status).toBe(200)
    expect(matchProviderAgainstOpenJobsMock).not.toHaveBeenCalled()
  })

  it('ein Fehler im Re-Matching lässt die Statusänderung trotzdem erfolgreich zurückkehren (isoliert)', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    matchProviderAgainstOpenJobsMock.mockRejectedValueOnce(new Error('Matching-DB down'))
    const res = await POST(req({ status: 'active' }), { params: Promise.resolve({ id: 'sub-1' }) })
    expect(res.status).toBe(200)
    consoleErrorSpy.mockRestore()
  })
})
