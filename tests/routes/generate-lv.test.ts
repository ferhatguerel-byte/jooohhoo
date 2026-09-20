import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { getCurrentUserMock, generateLeistungsverzeichnisMock, queryMock } = vi.hoisted(() => ({
  getCurrentUserMock: vi.fn(),
  generateLeistungsverzeichnisMock: vi.fn(),
  queryMock: vi.fn(),
}))
vi.mock('@/lib/current-user', () => ({ getCurrentUser: getCurrentUserMock }))
vi.mock('@/lib/ai', () => ({ generateLeistungsverzeichnis: generateLeistungsverzeichnisMock }))
vi.mock('@/lib/db', () => ({ getDb: () => ({ query: queryMock }) }))

import { POST } from '@/app/api/jobs/generate-lv/route'

function req(description: string) {
  return new NextRequest('http://localhost/api/jobs/generate-lv', {
    method: 'POST',
    body: JSON.stringify({ description }),
    headers: { 'content-type': 'application/json' },
  })
}

const LONG_DESCRIPTION = 'Sanierung eines Badezimmers inklusive Fliesen, Sanitär und Elektrik.'

describe('POST /api/jobs/generate-lv', () => {
  beforeEach(() => {
    getCurrentUserMock.mockReset()
    generateLeistungsverzeichnisMock.mockReset()
    queryMock.mockReset()
  })

  it('rejects non-Auftraggeber roles', async () => {
    getCurrentUserMock.mockResolvedValue({ id: 'u1', role: 'subunternehmer' })
    const res = await POST(req(LONG_DESCRIPTION))
    expect(res.status).toBe(403)
    expect(generateLeistungsverzeichnisMock).not.toHaveBeenCalled()
  })

  it('calls the AI generator when under the rate limit', async () => {
    getCurrentUserMock.mockResolvedValue({ id: 'u1', role: 'auftraggeber' })
    // Alle Rate-Limit-Abfragen (COUNT + INSERT je Bucket) sowie das beiläufige, zufällig
    // ausgelöste Cleanup dürfen erfolgreich zurückkehren.
    queryMock.mockResolvedValue({ rows: [{ count: 0 }] })
    generateLeistungsverzeichnisMock.mockResolvedValue({ items: [] })

    const res = await POST(req(LONG_DESCRIPTION))

    expect(res.status).toBe(200)
    expect(generateLeistungsverzeichnisMock).toHaveBeenCalledOnce()
  })

  it('returns 429 and skips the (paid) AI call once the per-user limit is hit', async () => {
    getCurrentUserMock.mockResolvedValue({ id: 'u1', role: 'auftraggeber' })
    queryMock.mockResolvedValueOnce({ rows: [{ count: 999 }] }) // Limit für diesen Nutzer bereits erreicht

    const res = await POST(req(LONG_DESCRIPTION))

    expect(res.status).toBe(429)
    expect(generateLeistungsverzeichnisMock).not.toHaveBeenCalled()
  })
})
