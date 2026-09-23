import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { getCurrentUserMock, queryMock } = vi.hoisted(() => ({
  getCurrentUserMock: vi.fn(),
  queryMock: vi.fn(),
}))
vi.mock('@/lib/current-user', () => ({ getCurrentUser: getCurrentUserMock }))
vi.mock('@/lib/db', () => ({ getDb: () => ({ query: queryMock }) }))
vi.mock('@/lib/email', () => ({ sendNewMessageEmail: vi.fn() }))

import { POST } from '@/app/api/offers/[id]/messages/route'

function req(body: unknown) {
  return new NextRequest('http://localhost/api/offers/offer-1/messages', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

const offerRow = {
  id: 'offer-1',
  subunternehmer_id: 'sub-1',
  auftraggeber_id: 'ag-1',
  subunternehmer_email: 's@example.com',
  subunternehmer_name: 'Sub GmbH',
  subunternehmer_notify: true,
  auftraggeber_email: 'a@example.com',
  auftraggeber_name: 'AG GmbH',
  auftraggeber_notify: true,
}

describe('POST /api/offers/[id]/messages — IDOR-Schutz', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9)
    getCurrentUserMock.mockReset()
    queryMock.mockReset()
  })

  it('rejects unauthenticated requests', async () => {
    getCurrentUserMock.mockResolvedValue(null)
    const res = await POST(req({ message: 'hi' }), { params: Promise.resolve({ id: 'offer-1' }) })
    expect(res.status).toBe(401)
  })

  it('denies a third party (neither the offering Unternehmer nor the Auftraggeber) access to the chat', async () => {
    getCurrentUserMock.mockResolvedValue({ id: 'stranger-1', role: 'auftraggeber' })
    // Phase 4.3: Rate-Limit-Prüfung (COUNT + INSERT) läuft vor dem Offer-Lookup.
    queryMock.mockResolvedValueOnce({ rows: [{ count: 0 }] })
    queryMock.mockResolvedValueOnce({})
    queryMock.mockResolvedValueOnce({ rows: [offerRow] })

    const res = await POST(req({ message: 'ich will mitlesen' }), { params: Promise.resolve({ id: 'offer-1' }) })

    expect(res.status).toBe(403)
    // Es darf kein INSERT für die fremde Nachricht ausgeführt worden sein (nur Rate-Limit + Lookup).
    expect(queryMock).toHaveBeenCalledTimes(3)
  })

  it('allows the offering Unternehmer to post a message on their own offer', async () => {
    getCurrentUserMock.mockResolvedValue({ id: 'sub-1', role: 'subunternehmer' })
    queryMock.mockResolvedValueOnce({ rows: [{ count: 0 }] })
    queryMock.mockResolvedValueOnce({})
    queryMock.mockResolvedValueOnce({ rows: [offerRow] })
    queryMock.mockResolvedValueOnce({})

    const res = await POST(req({ message: 'Angebot Update' }), { params: Promise.resolve({ id: 'offer-1' }) })

    expect(res.status).toBe(200)
  })

  it('allows the Auftraggeber who owns the job to post a message', async () => {
    getCurrentUserMock.mockResolvedValue({ id: 'ag-1', role: 'auftraggeber' })
    queryMock.mockResolvedValueOnce({ rows: [{ count: 0 }] })
    queryMock.mockResolvedValueOnce({})
    queryMock.mockResolvedValueOnce({ rows: [offerRow] })
    queryMock.mockResolvedValueOnce({})

    const res = await POST(req({ message: 'Frage zum Angebot' }), { params: Promise.resolve({ id: 'offer-1' }) })

    expect(res.status).toBe(200)
  })
})
