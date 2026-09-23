import { describe, it, expect, vi, beforeEach } from 'vitest'

const queryMock = vi.fn()
vi.mock('@/lib/db', () => ({ getDb: () => ({ query: queryMock }) }))

import { GET } from '@/app/api/health/route'

describe('GET /api/health — Phase 4.4 (Teil 10)', () => {
  beforeEach(() => {
    queryMock.mockReset()
  })

  it('returns 200 with status ok when the DB is reachable', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] })
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.db).toBe('ok')
    expect(typeof body.latencyMs).toBe('number')
  })

  it('returns 503 with no internal details when the DB is unreachable', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    queryMock.mockRejectedValueOnce(new Error('connection refused: postgres://user:secret@host/db'))
    const res = await GET()
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.status).toBe('error')
    expect(body.db).toBe('unreachable')
    // Keine Verbindungsdetails/Secrets in der öffentlichen Antwort.
    expect(JSON.stringify(body)).not.toContain('secret')
    expect(JSON.stringify(body)).not.toContain('postgres://')
    spy.mockRestore()
  })

  it('never throws even if the query call itself rejects synchronously', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    queryMock.mockRejectedValueOnce(new Error('ECONNREFUSED'))
    await expect(GET()).resolves.toBeDefined()
    spy.mockRestore()
  })
})
