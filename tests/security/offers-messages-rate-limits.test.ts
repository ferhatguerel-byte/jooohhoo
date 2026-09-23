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
vi.mock('@/lib/email', () => ({ sendNewOfferEmail: vi.fn(), sendNewMessageEmail: vi.fn() }))

import { POST as submitOffer } from '@/app/api/jobs/[id]/offers/route'
import { POST as postMessage } from '@/app/api/offers/[id]/messages/route'

function jsonReq(url: string, body: unknown) {
  return new NextRequest(url, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })
}

describe('POST /api/jobs/[id]/offers — Phase 4.3 Rate Limit (Teil 2/A: Angebots-Spam)', () => {
  beforeEach(() => {
    getCurrentUserMock.mockReset()
    queryMock.mockReset()
    connectMock.mockReset()
    clientQueryMock.mockReset()
    releaseMock.mockReset()
    vi.spyOn(Math, 'random').mockReturnValue(0.9)
    getCurrentUserMock.mockResolvedValue({
      id: 'sub-1',
      role: 'subunternehmer',
      subscriptionStatus: 'active',
      subscriptionTier: 'monthly',
      verifiedGewerke: ['Elektro'],
      blockedGewerke: [],
    })
    connectMock.mockResolvedValue({ query: clientQueryMock, release: releaseMock })
    clientQueryMock.mockResolvedValue({ rows: [{ id: 'offer-1' }] })
  })

  it('lehnt wiederholte Angebotsabgabe/-änderung ab, sobald das Limit erreicht ist (429)', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ count: 30 }] })
    const res = await submitOffer(jsonReq('http://localhost/api/jobs/job-1/offers', { price: 1000 }), {
      params: Promise.resolve({ id: 'job-1' }),
    })
    expect(res.status).toBe(429)
    expect(queryMock).toHaveBeenCalledTimes(1) // nur die Rate-Limit-COUNT, kein Job-Lookup danach
  })

  it('erlaubt Angebotsabgabe unterhalb des Limits', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ count: 0 }] }) // Rate-Limit COUNT
    queryMock.mockResolvedValueOnce({}) // Rate-Limit INSERT
    queryMock.mockResolvedValueOnce({
      rows: [{ id: 'job-1', title: 'Test', gewerk: 'Elektro', email: 'ag@example.com', email_notifications: false }],
    }) // Job-Lookup
    queryMock.mockResolvedValueOnce({ rows: [] }) // alreadyContacted
    queryMock.mockResolvedValueOnce({ rows: [{ count: 0 }] }) // contactedThisMonth

    const res = await submitOffer(jsonReq('http://localhost/api/jobs/job-1/offers', { price: 1000 }), {
      params: Promise.resolve({ id: 'job-1' }),
    })
    expect(res.status).toBe(200)
  })
})

describe('POST /api/offers/[id]/messages — Phase 4.3 Rate Limit (Teil 2/A: Chat-Spam)', () => {
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

  beforeEach(() => {
    getCurrentUserMock.mockReset()
    queryMock.mockReset()
    vi.spyOn(Math, 'random').mockReturnValue(0.9)
    getCurrentUserMock.mockResolvedValue({ id: 'sub-1', role: 'subunternehmer' })
  })

  it('lehnt wiederholtes Nachrichtensenden ab, sobald das enge Zeitfenster-Limit erreicht ist (429)', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ count: 20 }] })
    const res = await postMessage(jsonReq('http://localhost/api/offers/offer-1/messages', { message: 'spam' }), {
      params: Promise.resolve({ id: 'offer-1' }),
    })
    expect(res.status).toBe(429)
    // Kein Offer-Lookup, keine Nachricht wurde eingefügt.
    expect(queryMock).toHaveBeenCalledTimes(1)
  })

  it('erlaubt Nachrichtensenden unterhalb des Limits', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ count: 0 }] })
    queryMock.mockResolvedValueOnce({})
    queryMock.mockResolvedValueOnce({ rows: [offerRow] })
    queryMock.mockResolvedValueOnce({})
    const res = await postMessage(jsonReq('http://localhost/api/offers/offer-1/messages', { message: 'Hallo' }), {
      params: Promise.resolve({ id: 'offer-1' }),
    })
    expect(res.status).toBe(200)
  })
})
