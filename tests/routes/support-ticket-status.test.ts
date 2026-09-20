import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { getCurrentUserMock, queryMock } = vi.hoisted(() => ({
  getCurrentUserMock: vi.fn(),
  queryMock: vi.fn(),
}))
vi.mock('@/lib/current-user', () => ({ getCurrentUser: getCurrentUserMock }))
vi.mock('@/lib/db', () => ({ getDb: () => ({ query: queryMock }) }))
vi.mock('@/lib/admin-audit', () => ({ logAdminAction: vi.fn() }))

import { POST } from '@/app/api/support/tickets/[id]/status/route'

function req(status: string) {
  return new NextRequest('http://localhost/api/support/tickets/t1/status', {
    method: 'POST',
    body: JSON.stringify({ status }),
    headers: { 'content-type': 'application/json' },
  })
}

describe('POST /api/support/tickets/[id]/status — Admin-Authorization', () => {
  beforeEach(() => {
    getCurrentUserMock.mockReset()
    queryMock.mockReset()
    vi.stubEnv('ADMIN_EMAIL', 'admin@example.com')
  })

  it('a normal user may close their own ticket', async () => {
    getCurrentUserMock.mockResolvedValue({ id: 'user-1', email: 'user@example.com', role: 'auftraggeber' })
    queryMock.mockResolvedValueOnce({ rows: [{ user_id: 'user-1' }] })
    queryMock.mockResolvedValueOnce({})

    const res = await POST(req('closed'), { params: Promise.resolve({ id: 't1' }) })
    expect(res.status).toBe(200)
  })

  it('a normal user may NOT re-open a ticket (support-only action)', async () => {
    getCurrentUserMock.mockResolvedValue({ id: 'user-1', email: 'user@example.com', role: 'auftraggeber' })
    queryMock.mockResolvedValueOnce({ rows: [{ user_id: 'user-1' }] })

    const res = await POST(req('open'), { params: Promise.resolve({ id: 't1' }) })
    expect(res.status).toBe(403)
  })

  it('a normal user may NEVER change the status of someone else\'s ticket (IDOR / privilege escalation)', async () => {
    getCurrentUserMock.mockResolvedValue({ id: 'attacker', email: 'attacker@evil.com', role: 'auftraggeber' })
    queryMock.mockResolvedValueOnce({ rows: [{ user_id: 'victim-1' }] })

    const res = await POST(req('closed'), { params: Promise.resolve({ id: 't1' }) })
    expect(res.status).toBe(403)
  })

  it('the admin may re-open any ticket', async () => {
    getCurrentUserMock.mockResolvedValue({ id: 'admin-1', email: 'admin@example.com', role: 'auftraggeber' })
    queryMock.mockResolvedValueOnce({ rows: [{ user_id: 'someone-else' }] })
    queryMock.mockResolvedValueOnce({})

    const res = await POST(req('open'), { params: Promise.resolve({ id: 't1' }) })
    expect(res.status).toBe(200)
  })
})
