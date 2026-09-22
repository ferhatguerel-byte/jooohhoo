import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { getCurrentUserMock, queryMock, connectMock, clientQueryMock, releaseMock } = vi.hoisted(() => ({
  getCurrentUserMock: vi.fn(),
  queryMock: vi.fn(),
  connectMock: vi.fn(),
  clientQueryMock: vi.fn(),
  releaseMock: vi.fn(),
}))
vi.mock('@/lib/current-user', () => ({ getCurrentUser: getCurrentUserMock }))
vi.mock('@/lib/db', () => ({ getDb: () => ({ query: queryMock, connect: connectMock }) }))
vi.mock('@/lib/email', () => ({ sendNewTicketEmail: vi.fn(), sendTicketReplyEmail: vi.fn() }))

import { POST as createTicket } from '@/app/api/support/tickets/route'
import { POST as postTicketMessage } from '@/app/api/support/tickets/[id]/messages/route'

function jsonReq(url: string, body: unknown) {
  return new NextRequest(url, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })
}

describe('POST /api/support/tickets — Phase 4.3 Rate Limit (Teil 6: Support-Ticket-Spam)', () => {
  beforeEach(() => {
    getCurrentUserMock.mockReset()
    queryMock.mockReset()
    connectMock.mockReset()
    clientQueryMock.mockReset()
    releaseMock.mockReset()
    getCurrentUserMock.mockResolvedValue({ id: 'u1', role: 'auftraggeber', companyName: 'Test GmbH' })
    connectMock.mockResolvedValue({ query: clientQueryMock, release: releaseMock })
    clientQueryMock.mockResolvedValue({ rows: [{ id: 'ticket-1' }] })
  })

  it('lehnt weitere Ticket-Erstellung ab, sobald das Limit (5/Stunde) erreicht ist (429)', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ count: 5 }] })
    const res = await createTicket(
      jsonReq('http://localhost/api/support/tickets', { category: 'Sonstiges', subject: 'Hilfe', message: 'Bitte helfen Sie mir.' })
    )
    expect(res.status).toBe(429)
    expect(connectMock).not.toHaveBeenCalled()
  })

  it('erlaubt Ticket-Erstellung unterhalb des Limits', async () => {
    queryMock.mockResolvedValue({ rows: [{ count: 0 }] })
    const res = await createTicket(
      jsonReq('http://localhost/api/support/tickets', { category: 'Sonstiges', subject: 'Hilfe', message: 'Bitte helfen Sie mir.' })
    )
    expect(res.status).toBe(200)
  })
})

describe('POST /api/support/tickets/[id]/messages — Phase 4.3 Rate Limit', () => {
  beforeEach(() => {
    getCurrentUserMock.mockReset()
    queryMock.mockReset()
  })

  it('lehnt weitere Antworten eines normalen Nutzers ab, sobald das Limit (20/Stunde) erreicht ist', async () => {
    getCurrentUserMock.mockResolvedValue({ id: 'u1', email: 'u1@example.com', role: 'auftraggeber' })
    queryMock.mockResolvedValueOnce({ rows: [{ count: 20 }] })
    const res = await postTicketMessage(
      jsonReq('http://localhost/api/support/tickets/t1/messages', { message: 'noch eine Nachricht' }),
      { params: Promise.resolve({ id: 't1' }) }
    )
    expect(res.status).toBe(429)
  })

  it('Admins haben ein großzügigeres Limit (60/Stunde) als normale Nutzer', async () => {
    vi.stubEnv('ADMIN_EMAIL', 'admin@example.com')
    getCurrentUserMock.mockResolvedValue({ id: 'admin-1', email: 'admin@example.com', role: 'auftraggeber' })
    // 25 Aufrufe würden einen normalen Nutzer (Limit 20) blockieren, einen Admin (Limit 60) nicht.
    queryMock.mockResolvedValueOnce({ rows: [{ count: 25 }] })
    queryMock.mockResolvedValueOnce({})
    queryMock.mockResolvedValueOnce({ rows: [{ user_id: 'someone-else', email: 'x@example.com', email_notifications: false, subject: 'x' }] })
    queryMock.mockResolvedValueOnce({})
    queryMock.mockResolvedValueOnce({})
    const res = await postTicketMessage(
      jsonReq('http://localhost/api/support/tickets/t1/messages', { message: 'Admin-Antwort' }),
      { params: Promise.resolve({ id: 't1' }) }
    )
    expect(res.status).toBe(200)
  })
})
