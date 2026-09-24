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

import { POST } from '@/app/api/admin/users/[id]/gewerke/route'

const PROVIDER_ID = '123e4567-e89b-12d3-a456-426614174000'

function req(body: unknown) {
  return new NextRequest(`http://localhost/api/admin/users/${PROVIDER_ID}/gewerke`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

describe('POST /api/admin/users/[id]/gewerke — Matching-Lifecycle Phase C (Re-Matching bei Gewerke-Sperre/-Freigabe)', () => {
  beforeEach(() => {
    requireAdminApiMock.mockReset()
    requireAdminApiMock.mockResolvedValue({ id: 'admin-1' })
    queryMock.mockReset()
    queryMock.mockResolvedValue({ rows: [] })
    logAdminActionMock.mockReset()
    matchProviderAgainstOpenJobsMock.mockReset()
    matchProviderAgainstOpenJobsMock.mockResolvedValue({ providerId: PROVIDER_ID, resultCount: 1, eligibleCount: 1, excludedCount: 0 })
  })

  it('1. Gewerk freigeben (blocked=false) löst matchProviderAgainstOpenJobs für den betroffenen Provider aus (neue Matches können entstehen)', async () => {
    const res = await POST(req({ gewerk: 'Trockenbau', blocked: false }), { params: Promise.resolve({ id: PROVIDER_ID }) })
    expect(res.status).toBe(200)
    expect(matchProviderAgainstOpenJobsMock).toHaveBeenCalledTimes(1)
    expect(matchProviderAgainstOpenJobsMock).toHaveBeenCalledWith(PROVIDER_ID)
  })

  it('2. Gewerk sperren (blocked=true) löst ebenfalls matchProviderAgainstOpenJobs aus – dieselbe Funktion invalidiert bestehende Matches über den Hard Filter (excluded=true), ohne eine zweite Invalidierungslogik', async () => {
    const res = await POST(req({ gewerk: 'Trockenbau', blocked: true }), { params: Promise.resolve({ id: PROVIDER_ID }) })
    expect(res.status).toBe(200)
    expect(matchProviderAgainstOpenJobsMock).toHaveBeenCalledTimes(1)
    expect(matchProviderAgainstOpenJobsMock).toHaveBeenCalledWith(PROVIDER_ID)
  })

  it('3. keine doppelten Notifications: matchProviderAgainstOpenJobs wird pro Admin-Aktion genau EINMAL aufgerufen (dieselbe ON CONFLICT DO NOTHING-Garantie wie beim bestehenden Matching greift dahinter)', async () => {
    await POST(req({ gewerk: 'Trockenbau', blocked: false }), { params: Promise.resolve({ id: PROVIDER_ID }) })
    expect(matchProviderAgainstOpenJobsMock).toHaveBeenCalledTimes(1)
  })

  it('4. ein Fehler im Best-Effort-Matching lässt die Admin-Aktion (Sperren) trotzdem erfolgreich zurückkehren', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    matchProviderAgainstOpenJobsMock.mockRejectedValueOnce(new Error('Matching-DB down'))
    const res = await POST(req({ gewerk: 'Trockenbau', blocked: true }), { params: Promise.resolve({ id: PROVIDER_ID }) })
    expect(res.status).toBe(200)
    // Die eigentliche Sperr-Aktion (UPDATE + Audit-Log) ist bereits vor dem Matching-Aufruf gelaufen.
    expect(queryMock).toHaveBeenCalled()
    expect(logAdminActionMock).toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
  })

  it('4b. ein Fehler im Best-Effort-Matching lässt die Admin-Aktion (Freigeben) trotzdem erfolgreich zurückkehren', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    matchProviderAgainstOpenJobsMock.mockRejectedValueOnce(new Error('Matching-DB down'))
    const res = await POST(req({ gewerk: 'Trockenbau', blocked: false }), { params: Promise.resolve({ id: PROVIDER_ID }) })
    expect(res.status).toBe(200)
    consoleErrorSpy.mockRestore()
  })

  it('ohne Admin-Rechte wird weder die Sperr-/Freigabe-Aktion noch ein Re-Matching ausgeführt', async () => {
    const { AuthorizationError } = await import('@/lib/authorization')
    requireAdminApiMock.mockRejectedValue(new AuthorizationError('Kein Zugriff.'))
    const res = await POST(req({ gewerk: 'Trockenbau', blocked: true }), { params: Promise.resolve({ id: PROVIDER_ID }) })
    expect(res.status).toBe(403)
    expect(queryMock).not.toHaveBeenCalled()
    expect(matchProviderAgainstOpenJobsMock).not.toHaveBeenCalled()
  })
})
