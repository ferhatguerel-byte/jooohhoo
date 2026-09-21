import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { getCurrentUserMock, getByIdMock, setStatusMock, clearOverrideMock, saveNoteMock, logAdminActionMock } = vi.hoisted(() => ({
  getCurrentUserMock: vi.fn(),
  getByIdMock: vi.fn(),
  setStatusMock: vi.fn(),
  clearOverrideMock: vi.fn(),
  saveNoteMock: vi.fn(),
  logAdminActionMock: vi.fn(),
}))
vi.mock('@/lib/current-user', () => ({ getCurrentUser: getCurrentUserMock }))
vi.mock('@/lib/admin-audit', () => ({ logAdminAction: logAdminActionMock }))
vi.mock('@/lib/seo/status', () => ({
  getSeoLandingPageById: getByIdMock,
  setAdminSeoStatus: setStatusMock,
  clearAdminOverride: clearOverrideMock,
  saveAdminNote: saveNoteMock,
}))

import { PATCH } from '@/app/api/admin/seo/[id]/route'

const ADMIN_EMAIL = 'admin@example.com'
const existingPage = {
  id: 'page-1',
  pageType: 'handwerker',
  gewerkSlug: 'trockenbau',
  citySlug: 'berlin',
  status: 'REVIEW',
  statusSource: 'AUTO',
}

function req(body: unknown) {
  return new NextRequest('http://localhost/api/admin/seo/page-1', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

describe('PATCH /api/admin/seo/[id] — Admin-only Status-Änderung', () => {
  beforeEach(() => {
    getCurrentUserMock.mockReset()
    getByIdMock.mockReset()
    setStatusMock.mockReset()
    clearOverrideMock.mockReset()
    saveNoteMock.mockReset()
    logAdminActionMock.mockReset()
    vi.stubEnv('ADMIN_EMAIL', ADMIN_EMAIL)
    getByIdMock.mockResolvedValue(existingPage)
  })

  it('lehnt nicht angemeldete Anfragen ab', async () => {
    getCurrentUserMock.mockResolvedValue(null)
    const res = await PATCH(req({ status: 'INDEXABLE' }), { params: Promise.resolve({ id: 'page-1' }) })
    expect(res.status).toBe(401)
    expect(setStatusMock).not.toHaveBeenCalled()
  })

  it('lehnt normale (nicht-admin) Nutzer ab — kein Statuswechsel möglich', async () => {
    getCurrentUserMock.mockResolvedValue({ id: 'u1', email: 'user@example.com' })
    const res = await PATCH(req({ status: 'INDEXABLE' }), { params: Promise.resolve({ id: 'page-1' }) })
    expect(res.status).toBe(403)
    expect(setStatusMock).not.toHaveBeenCalled()
  })

  it('erlaubt dem Admin, INDEXABLE zu setzen, und protokolliert die Änderung', async () => {
    getCurrentUserMock.mockResolvedValue({ id: 'admin-1', email: ADMIN_EMAIL })
    getByIdMock.mockResolvedValueOnce(existingPage).mockResolvedValueOnce({ ...existingPage, status: 'INDEXABLE', statusSource: 'ADMIN' })

    const res = await PATCH(req({ status: 'INDEXABLE' }), { params: Promise.resolve({ id: 'page-1' }) })

    expect(res.status).toBe(200)
    expect(setStatusMock).toHaveBeenCalledWith(existingPage, 'INDEXABLE', undefined)
    expect(logAdminActionMock).toHaveBeenCalledOnce()
    expect(logAdminActionMock.mock.calls[0][1]).toBe('SEO_STATUS_CHANGED')
  })

  it('resetToAuto ruft clearAdminOverride statt setAdminSeoStatus', async () => {
    getCurrentUserMock.mockResolvedValue({ id: 'admin-1', email: ADMIN_EMAIL })
    const res = await PATCH(req({ resetToAuto: true }), { params: Promise.resolve({ id: 'page-1' }) })
    expect(res.status).toBe(200)
    expect(clearOverrideMock).toHaveBeenCalledWith(existingPage)
    expect(setStatusMock).not.toHaveBeenCalled()
  })

  it('eine reine Notiz-Aktualisierung ändert nie den Status', async () => {
    getCurrentUserMock.mockResolvedValue({ id: 'admin-1', email: ADMIN_EMAIL })
    const res = await PATCH(req({ adminNote: 'nur eine Notiz' }), { params: Promise.resolve({ id: 'page-1' }) })
    expect(res.status).toBe(200)
    expect(saveNoteMock).toHaveBeenCalledWith(existingPage, 'nur eine Notiz')
    expect(setStatusMock).not.toHaveBeenCalled()
  })

  it('gibt 404 für eine unbekannte Seiten-ID zurück', async () => {
    getCurrentUserMock.mockResolvedValue({ id: 'admin-1', email: ADMIN_EMAIL })
    getByIdMock.mockReset()
    getByIdMock.mockResolvedValue(null)
    const res = await PATCH(req({ status: 'INDEXABLE' }), { params: Promise.resolve({ id: 'unknown' }) })
    expect(res.status).toBe(404)
  })

  it('lehnt einen ungültigen Status-Wert ab (400, keine DB-Schreibaktion)', async () => {
    getCurrentUserMock.mockResolvedValue({ id: 'admin-1', email: ADMIN_EMAIL })
    const res = await PATCH(req({ status: 'HACKED' }), { params: Promise.resolve({ id: 'page-1' }) })
    expect(res.status).toBe(400)
    expect(setStatusMock).not.toHaveBeenCalled()
  })
})
