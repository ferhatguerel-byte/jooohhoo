import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { getCurrentUserMock, queryMock, putMock, optimizeMock } = vi.hoisted(() => ({
  getCurrentUserMock: vi.fn(),
  queryMock: vi.fn(),
  putMock: vi.fn(),
  optimizeMock: vi.fn(),
}))
vi.mock('@/lib/current-user', () => ({ getCurrentUser: getCurrentUserMock }))
vi.mock('@/lib/db', () => ({ getDb: () => ({ query: queryMock }) }))
vi.mock('@vercel/blob', () => ({ put: putMock }))
vi.mock('@/lib/image-optimize', () => ({ optimizeImageIfNeeded: optimizeMock }))

import { POST } from '@/app/api/upload/route'

function reqWithFile(file: File, purpose = 'job_attachment') {
  const formData = new FormData()
  formData.set('file', file)
  formData.set('purpose', purpose)
  return new NextRequest('http://localhost/api/upload', { method: 'POST', body: formData })
}

describe('POST /api/upload', () => {
  beforeEach(() => {
    getCurrentUserMock.mockReset()
    queryMock.mockReset()
    putMock.mockReset()
    optimizeMock.mockReset()
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'test-token')
    getCurrentUserMock.mockResolvedValue({ id: 'user-1' })
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('rate_limit_hits')) return { rows: [{ count: 0 }] }
      if (sql.includes('INSERT INTO private_files')) return { rows: [{ id: 'new-file-id' }] }
      return { rows: [] }
    })
    putMock.mockResolvedValue({ pathname: 'private/job_attachment/user-1/file.pdf' })
    optimizeMock.mockImplementation(async (file: File) => ({
      buffer: Buffer.from(await file.arrayBuffer()),
      contentType: file.type,
    }))
  })

  it('rejects unauthenticated uploads', async () => {
    getCurrentUserMock.mockResolvedValue(null)
    const file = new File(['data'], 'doc.pdf', { type: 'application/pdf' })
    const res = await POST(reqWithFile(file))
    expect(res.status).toBe(401)
  })

  it('rejects an invalid/missing purpose', async () => {
    const file = new File(['%PDF-1.4 ...'], 'nachweis.pdf', { type: 'application/pdf' })
    const res = await POST(reqWithFile(file, 'anything-else'))
    expect(res.status).toBe(400)
    expect(putMock).not.toHaveBeenCalled()
  })

  it('accepts a valid PDF and stores it privately, returning a fileId (never a direct URL)', async () => {
    const file = new File(['%PDF-1.4 ...'], 'nachweis.pdf', { type: 'application/pdf' })
    const res = await POST(reqWithFile(file, 'qualification_file'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.fileId).toBe('new-file-id')
    expect(body.url).toBeUndefined()
    expect(putMock).toHaveBeenCalledOnce()
    expect(putMock.mock.calls[0][2]).toMatchObject({ access: 'private' })
  })

  it('rejects a disallowed MIME type (e.g. an executable)', async () => {
    const file = new File(['MZ...'], 'installer.exe', { type: 'application/x-msdownload' })
    const res = await POST(reqWithFile(file))
    expect(res.status).toBe(400)
    expect(putMock).not.toHaveBeenCalled()
  })

  it('rejects a file whose extension does not match its declared MIME type (spoofing attempt)', async () => {
    // Angreifer deklariert eine ausführbare Datei fälschlich als "image/png".
    const file = new File(['MZ...'], 'payload.exe', { type: 'image/png' })
    const res = await POST(reqWithFile(file))
    expect(res.status).toBe(400)
    expect(putMock).not.toHaveBeenCalled()
  })

  it('rejects path traversal attempts in the filename', async () => {
    const file = new File(['data'], '../../etc/passwd.png', { type: 'image/png' })
    const res = await POST(reqWithFile(file))
    // Entweder abgelehnt, oder der Pfad wird auf den Basisnamen reduziert — niemals wird
    // ein "../"-Anteil an den Storage-Pfad durchgereicht.
    if (res.status === 200) {
      const storagePath = putMock.mock.calls[0][0] as string
      expect(storagePath).not.toContain('..')
      expect(storagePath).not.toContain('/etc/')
    } else {
      expect(res.status).toBe(400)
    }
  })

  it('rejects files exceeding the size limit', async () => {
    const bigContent = new Uint8Array(11 * 1024 * 1024)
    const file = new File([bigContent], 'big.pdf', { type: 'application/pdf' })
    const res = await POST(reqWithFile(file))
    expect(res.status).toBe(400)
    expect(putMock).not.toHaveBeenCalled()
  })
})
