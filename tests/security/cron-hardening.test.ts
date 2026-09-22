import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { queryMock, runMatchEmailRetryBatchMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
  runMatchEmailRetryBatchMock: vi.fn(),
}))
vi.mock('@/lib/db', () => ({ getDb: () => ({ query: queryMock }) }))
vi.mock('@/lib/matching/retry-match-notification-emails', () => ({
  runMatchEmailRetryBatch: runMatchEmailRetryBatchMock,
}))

import { GET } from '@/app/api/internal/match-email-retry/route'

function req(authHeader?: string) {
  const headers = new Headers({ 'x-forwarded-for': '1.2.3.4' })
  if (authHeader) headers.set('authorization', authHeader)
  return new NextRequest('http://localhost/api/internal/match-email-retry', { headers })
}

describe('GET /api/internal/match-email-retry — Phase 4.3 (Teil 7: Cron-Abuse-Schutz)', () => {
  beforeEach(() => {
    queryMock.mockReset()
    runMatchEmailRetryBatchMock.mockReset()
    runMatchEmailRetryBatchMock.mockResolvedValue({ candidateCount: 0, outcomes: [] })
    vi.stubEnv('CRON_SECRET', 'correct-secret')
    vi.spyOn(Math, 'random').mockReturnValue(0.9)
  })

  it('rejects a request without CRON_SECRET configured (fail-closed)', async () => {
    vi.stubEnv('CRON_SECRET', '')
    const res = await GET(req('Bearer anything'))
    expect(res.status).toBe(401)
    expect(runMatchEmailRetryBatchMock).not.toHaveBeenCalled()
  })

  it('rejects an incorrect secret and counts the failed attempt by IP (Brute-Force-Bremse)', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ count: 0 }] })
    queryMock.mockResolvedValueOnce({})
    const res = await GET(req('Bearer wrong-secret'))
    expect(res.status).toBe(401)
    expect(runMatchEmailRetryBatchMock).not.toHaveBeenCalled()
    expect(queryMock.mock.calls[0][1]).toContain('cron-match-email-retry-authfail')
  })

  it('a failing auth-fail rate-limit write never blocks the 401 response (best-effort)', async () => {
    queryMock.mockRejectedValueOnce(new Error('DB down'))
    const res = await GET(req('Bearer wrong-secret'))
    expect(res.status).toBe(401)
  })

  it('accepts a correct secret within budget and runs the batch job', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ count: 0 }] }) // global budget COUNT
    queryMock.mockResolvedValueOnce({}) // global budget INSERT
    const res = await GET(req('Bearer correct-secret'))
    expect(res.status).toBe(200)
    expect(runMatchEmailRetryBatchMock).toHaveBeenCalledTimes(1)
  })

  it('rejects an authorized call once the global invocation budget is exhausted (misconfigured/duplicate cron source)', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ count: 20 }] }) // global budget am Limit
    const res = await GET(req('Bearer correct-secret'))
    expect(res.status).toBe(429)
    expect(runMatchEmailRetryBatchMock).not.toHaveBeenCalled()
  })

  it('uses a timing-safe comparison and never leaks whether the secret was close (constant rejection message)', async () => {
    queryMock.mockResolvedValue({ rows: [{ count: 0 }] })
    const res1 = await GET(req('Bearer wrong'))
    const body1 = await res1.json()
    const res2 = await GET(req(undefined))
    const body2 = await res2.json()
    expect(body1).toEqual(body2)
  })
})
