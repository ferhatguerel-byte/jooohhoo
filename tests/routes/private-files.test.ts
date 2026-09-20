import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { getCurrentUserMock, queryMock, getBlobMock } = vi.hoisted(() => ({
  getCurrentUserMock: vi.fn(),
  queryMock: vi.fn(),
  getBlobMock: vi.fn(),
}))
vi.mock('@/lib/current-user', () => ({ getCurrentUser: getCurrentUserMock }))
vi.mock('@/lib/db', () => ({ getDb: () => ({ query: queryMock }) }))
vi.mock('@vercel/blob', () => ({ get: getBlobMock }))

import { GET } from '@/app/api/files/[id]/route'

function req() {
  return new NextRequest('http://localhost/api/files/f1')
}

const fakeStream = new ReadableStream()

describe('GET /api/files/[id] — privater Datei-Zugriff', () => {
  beforeEach(() => {
    getCurrentUserMock.mockReset()
    queryMock.mockReset()
    getBlobMock.mockReset()
    getBlobMock.mockResolvedValue({ statusCode: 200, stream: fakeStream })
  })

  it('rejects unauthenticated requests', async () => {
    getCurrentUserMock.mockResolvedValue(null)
    const res = await GET(req(), { params: Promise.resolve({ id: 'f1' }) })
    expect(res.status).toBe(401)
    expect(getBlobMock).not.toHaveBeenCalled()
  })

  it('returns 404 for an unknown fileId', async () => {
    getCurrentUserMock.mockResolvedValue({ id: 'u1', role: 'auftraggeber' })
    queryMock.mockResolvedValueOnce({ rows: [] })
    const res = await GET(req(), { params: Promise.resolve({ id: 'f1' }) })
    expect(res.status).toBe(404)
  })

  describe('qualification_file (Nachweise wie Meisterbrief/Gewerbeanmeldung)', () => {
    const fileRow = {
      id: 'f1',
      pathname: 'private/qualification_file/owner-1/x.pdf',
      original_name: 'meisterbrief.pdf',
      content_type: 'application/pdf',
      uploaded_by: 'owner-1',
      purpose: 'qualification_file',
    }

    it('allows the uploader to download their own qualification document', async () => {
      getCurrentUserMock.mockResolvedValue({ id: 'owner-1', email: 'sub@example.com', role: 'subunternehmer' })
      queryMock.mockResolvedValueOnce({ rows: [fileRow] })
      const res = await GET(req(), { params: Promise.resolve({ id: 'f1' }) })
      expect(res.status).toBe(200)
      expect(getBlobMock).toHaveBeenCalledWith(fileRow.pathname, { access: 'private' })
    })

    it('denies a random other user access to someone else\'s qualification document (IDOR)', async () => {
      getCurrentUserMock.mockResolvedValue({ id: 'attacker', email: 'attacker@evil.com', role: 'subunternehmer' })
      vi.stubEnv('ADMIN_EMAIL', 'admin@example.com')
      queryMock.mockResolvedValueOnce({ rows: [fileRow] })
      const res = await GET(req(), { params: Promise.resolve({ id: 'f1' }) })
      expect(res.status).toBe(403)
      expect(getBlobMock).not.toHaveBeenCalled()
    })

    it('allows the admin to review a qualification document for verification', async () => {
      vi.stubEnv('ADMIN_EMAIL', 'admin@example.com')
      getCurrentUserMock.mockResolvedValue({ id: 'admin-1', email: 'admin@example.com', role: 'auftraggeber' })
      queryMock.mockResolvedValueOnce({ rows: [fileRow] })
      const res = await GET(req(), { params: Promise.resolve({ id: 'f1' }) })
      expect(res.status).toBe(200)
    })
  })

  describe('job_attachment (Bilder/Dateien zu einem Auftrag)', () => {
    const fileRow = {
      id: 'f2',
      pathname: 'private/job_attachment/owner-1/x.png',
      original_name: 'grundriss.png',
      content_type: 'image/png',
      uploaded_by: 'owner-1',
      purpose: 'job_attachment',
    }

    it('allows the job owner (Auftraggeber) to view the attachment', async () => {
      getCurrentUserMock.mockResolvedValue({ id: 'owner-1', role: 'auftraggeber' })
      queryMock.mockResolvedValueOnce({ rows: [fileRow] })
      const res = await GET(req(), { params: Promise.resolve({ id: 'f2' }) })
      expect(res.status).toBe(200)
    })

    it('allows any Subunternehmer to view attachments of a currently open job (matches marketplace visibility)', async () => {
      getCurrentUserMock.mockResolvedValue({ id: 'browsing-sub', role: 'subunternehmer' })
      queryMock.mockResolvedValueOnce({ rows: [fileRow] })
      queryMock.mockResolvedValueOnce({ rows: [{ id: 'job-1', auftraggeber_id: 'owner-1', status: 'open' }] })
      const res = await GET(req(), { params: Promise.resolve({ id: 'f2' }) })
      expect(res.status).toBe(200)
    })

    it('denies a Subunternehmer without an offer from viewing attachments of a closed job (IDOR)', async () => {
      getCurrentUserMock.mockResolvedValue({ id: 'stranger-sub', role: 'subunternehmer' })
      queryMock.mockResolvedValueOnce({ rows: [fileRow] })
      queryMock.mockResolvedValueOnce({ rows: [{ id: 'job-1', auftraggeber_id: 'owner-1', status: 'closed' }] })
      queryMock.mockResolvedValueOnce({ rows: [] }) // keine eigene Angebotsbeziehung
      const res = await GET(req(), { params: Promise.resolve({ id: 'f2' }) })
      expect(res.status).toBe(403)
    })

    it('allows a Subunternehmer with an existing offer to still view attachments after the job closed', async () => {
      getCurrentUserMock.mockResolvedValue({ id: 'offering-sub', role: 'subunternehmer' })
      queryMock.mockResolvedValueOnce({ rows: [fileRow] })
      queryMock.mockResolvedValueOnce({ rows: [{ id: 'job-1', auftraggeber_id: 'owner-1', status: 'closed' }] })
      queryMock.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] }) // hat ein Angebot abgegeben
      const res = await GET(req(), { params: Promise.resolve({ id: 'f2' }) })
      expect(res.status).toBe(200)
    })

    it('denies an unrelated Auftraggeber (not the job owner) from viewing the attachment', async () => {
      getCurrentUserMock.mockResolvedValue({ id: 'other-ag', role: 'auftraggeber' })
      queryMock.mockResolvedValueOnce({ rows: [fileRow] })
      queryMock.mockResolvedValueOnce({ rows: [{ id: 'job-1', auftraggeber_id: 'owner-1', status: 'closed' }] })
      queryMock.mockResolvedValueOnce({ rows: [] })
      const res = await GET(req(), { params: Promise.resolve({ id: 'f2' }) })
      expect(res.status).toBe(403)
    })
  })
})
