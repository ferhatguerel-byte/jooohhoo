import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { requireAdminApiMock, logAdminActionMock, matchProviderAgainstOpenJobsMock } = vi.hoisted(() => ({
  requireAdminApiMock: vi.fn(),
  logAdminActionMock: vi.fn(),
  matchProviderAgainstOpenJobsMock: vi.fn(),
}))
vi.mock('@/lib/authorization', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  requireAdminApi: requireAdminApiMock,
}))
vi.mock('@/lib/admin-audit', () => ({ logAdminAction: logAdminActionMock }))
vi.mock('@/lib/matching/run-provider-matching', () => ({ matchProviderAgainstOpenJobs: matchProviderAgainstOpenJobsMock }))

import { POST } from '@/app/api/admin/matching/rematch-provider/route'
import { AuthorizationError } from '@/lib/authorization'

const VALID_PROVIDER_ID = '123e4567-e89b-12d3-a456-426614174000'

function req(body: unknown) {
  return new NextRequest('http://localhost/api/admin/matching/rematch-provider', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

describe('POST /api/admin/matching/rematch-provider — Backfill für bestehende Handwerker', () => {
  beforeEach(() => {
    requireAdminApiMock.mockReset()
    requireAdminApiMock.mockResolvedValue({ id: 'admin-1' })
    logAdminActionMock.mockReset()
    matchProviderAgainstOpenJobsMock.mockReset()
    matchProviderAgainstOpenJobsMock.mockResolvedValue({ providerId: VALID_PROVIDER_ID, resultCount: 3, eligibleCount: 2, excludedCount: 1 })
  })

  it('ohne gültige Admin-Session ist der Endpunkt nicht erreichbar (403), kein Matching-Aufruf', async () => {
    requireAdminApiMock.mockRejectedValue(new AuthorizationError('Kein Zugriff.'))
    const res = await POST(req({ providerId: VALID_PROVIDER_ID }))
    expect(res.status).toBe(403)
    expect(matchProviderAgainstOpenJobsMock).not.toHaveBeenCalled()
  })

  it('mit gültiger Admin-Session wird matchProviderAgainstOpenJobs für GENAU den angegebenen Provider aufgerufen', async () => {
    const res = await POST(req({ providerId: VALID_PROVIDER_ID }))
    expect(res.status).toBe(200)
    expect(matchProviderAgainstOpenJobsMock).toHaveBeenCalledTimes(1)
    expect(matchProviderAgainstOpenJobsMock).toHaveBeenCalledWith(VALID_PROVIDER_ID)
    const body = await res.json()
    expect(body).toEqual({ ok: true, providerId: VALID_PROVIDER_ID, resultCount: 3, eligibleCount: 2, excludedCount: 1 })
  })

  it('protokolliert die Aktion über logAdminAction (Audit-Trail)', async () => {
    await POST(req({ providerId: VALID_PROVIDER_ID }))
    expect(logAdminActionMock).toHaveBeenCalledWith(
      'admin-1',
      'PROVIDER_REMATCHED',
      'user',
      VALID_PROVIDER_ID,
      expect.objectContaining({ resultCount: 3, eligibleCount: 2 }),
      expect.anything()
    )
  })

  it('lehnt eine ungültige providerId ab (kein UUID), kein Matching-Aufruf', async () => {
    const res = await POST(req({ providerId: 'not-a-uuid' }))
    expect(res.status).toBe(400)
    expect(matchProviderAgainstOpenJobsMock).not.toHaveBeenCalled()
  })

  it('kein automatisches Massenmatching: es gibt keinen Weg, mehrere Provider in einem Aufruf zu matchen', async () => {
    const res = await POST(req({ providerId: VALID_PROVIDER_ID, providerIds: ['a', 'b', 'c'] }))
    expect(res.status).toBe(200)
    expect(matchProviderAgainstOpenJobsMock).toHaveBeenCalledTimes(1)
    expect(matchProviderAgainstOpenJobsMock).toHaveBeenCalledWith(VALID_PROVIDER_ID)
  })
})
