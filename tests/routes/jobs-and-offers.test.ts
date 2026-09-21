import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { getCurrentUserMock, queryMock, connectMock, clientQueryMock, releaseMock, trackEventMock } = vi.hoisted(() => ({
  getCurrentUserMock: vi.fn(),
  queryMock: vi.fn(),
  connectMock: vi.fn(),
  clientQueryMock: vi.fn(),
  releaseMock: vi.fn(),
  trackEventMock: vi.fn(),
}))
vi.mock('@/lib/current-user', () => ({ getCurrentUser: getCurrentUserMock }))
vi.mock('@/lib/db', () => ({ getDb: () => ({ query: queryMock, connect: connectMock }) }))
vi.mock('@/lib/email', () => ({ sendNewOfferEmail: vi.fn() }))
vi.mock('@/lib/analytics-events', () => ({ trackEvent: trackEventMock }))

import { POST as createJob } from '@/app/api/jobs/route'
import { POST as submitOffer } from '@/app/api/jobs/[id]/offers/route'

function jsonReq(url: string, body: unknown) {
  return new NextRequest(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

describe('POST /api/jobs — nur Auftraggeber dürfen Aufträge erstellen', () => {
  beforeEach(() => {
    getCurrentUserMock.mockReset()
    queryMock.mockReset()
    connectMock.mockReset()
  })

  it('rejects a Subunternehmer trying to create a job', async () => {
    getCurrentUserMock.mockResolvedValue({ id: 'u1', role: 'subunternehmer' })
    const res = await createJob(
      jsonReq('http://localhost/api/jobs', {
        title: 'Badezimmer renovieren',
        gewerk: 'sanitaer',
        plz: '10115',
        ort: 'Berlin',
        description: 'Komplettsanierung eines Badezimmers in einer Altbauwohnung.',
      })
    )
    expect(res.status).toBe(403)
    expect(connectMock).not.toHaveBeenCalled()
  })

  it('rejects an unauthenticated request', async () => {
    getCurrentUserMock.mockResolvedValue(null)
    const res = await createJob(jsonReq('http://localhost/api/jobs', { title: 'x' }))
    expect(res.status).toBe(403)
  })
})

describe('POST /api/jobs/[id]/offers — nur Unternehmer mit aktivem Abo dürfen Angebote abgeben', () => {
  beforeEach(() => {
    getCurrentUserMock.mockReset()
    queryMock.mockReset()
  })

  it('rejects an Auftraggeber trying to submit an offer', async () => {
    getCurrentUserMock.mockResolvedValue({ id: 'u1', role: 'auftraggeber' })
    const res = await submitOffer(jsonReq('http://localhost/api/jobs/j1/offers', { price: 1000 }), {
      params: Promise.resolve({ id: 'j1' }),
    })
    expect(res.status).toBe(403)
  })

  it('rejects a Subunternehmer without an active subscription', async () => {
    getCurrentUserMock.mockResolvedValue({
      id: 'u1',
      role: 'subunternehmer',
      subscriptionStatus: 'inactive',
      subscriptionTier: null,
    })
    const res = await submitOffer(jsonReq('http://localhost/api/jobs/j1/offers', { price: 1000 }), {
      params: Promise.resolve({ id: 'j1' }),
    })
    expect(res.status).toBe(402)
    expect(queryMock).not.toHaveBeenCalled()
  })
})

describe('POST /api/jobs/[id]/offers — Phase 3.6G OFFER_RECEIVED (OFFER_CREATED) Analytics', () => {
  beforeEach(() => {
    getCurrentUserMock.mockReset()
    queryMock.mockReset()
    connectMock.mockReset()
    clientQueryMock.mockReset()
    releaseMock.mockReset()
    trackEventMock.mockReset()
    trackEventMock.mockResolvedValue(undefined)

    getCurrentUserMock.mockResolvedValue({
      id: 'sub-1',
      role: 'subunternehmer',
      subscriptionStatus: 'active',
      subscriptionTier: 'monthly',
      verifiedGewerke: [],
      blockedGewerke: [],
      companyName: 'Sub GmbH',
    })
    connectMock.mockResolvedValue({ query: clientQueryMock, release: releaseMock })
    queryMock.mockImplementation((sql: string) => {
      if (typeof sql === 'string' && sql.includes('FROM jobs j JOIN users u')) {
        return Promise.resolve({ rows: [{ id: 'j1', title: 'Test', gewerk: 'Trockenbau', email: 'ag@example.com', email_notifications: false }] })
      }
      if (typeof sql === 'string' && sql.includes('FROM offers WHERE job_id')) {
        return Promise.resolve({ rows: [] })
      }
      if (typeof sql === 'string' && sql.includes('COUNT(*)::int AS count')) {
        return Promise.resolve({ rows: [{ count: 0 }] })
      }
      return Promise.resolve({ rows: [] })
    })
    clientQueryMock.mockImplementation((sql: string) => {
      if (typeof sql === 'string' && sql.includes('INSERT INTO offers')) {
        return Promise.resolve({ rows: [{ id: 'offer-1' }] })
      }
      return Promise.resolve({ rows: [] })
    })
  })

  it('trackt OFFER_RECEIVED (OFFER_CREATED-Äquivalent) NACH erfolgreichem Commit, mit offerId als idempotencyKey', async () => {
    const res = await submitOffer(jsonReq('http://localhost/api/jobs/j1/offers', { price: 1000 }), {
      params: Promise.resolve({ id: 'j1' }),
    })
    expect(res.status).toBe(200)
    expect(trackEventMock).toHaveBeenCalledWith({
      event: 'offer_received',
      actorUserId: 'sub-1',
      providerId: 'sub-1',
      jobId: 'j1',
      idempotencyKey: 'offer_created:offer-1',
    })
  })

  it('kein Preiswert in den Analytics-Aufrufparametern', async () => {
    await submitOffer(jsonReq('http://localhost/api/jobs/j1/offers', { price: 1000 }), {
      params: Promise.resolve({ id: 'j1' }),
    })
    const [input] = trackEventMock.mock.calls[0]
    expect(JSON.stringify(input)).not.toContain('1000')
  })

  it('ein Fehler beim Analytics-Tracking verhindert nicht die erfolgreiche Angebotsabgabe', async () => {
    trackEventMock.mockRejectedValue(new Error('Analytics-DB down'))
    const res = await submitOffer(jsonReq('http://localhost/api/jobs/j1/offers', { price: 1000 }), {
      params: Promise.resolve({ id: 'j1' }),
    })
    expect(res.status).toBe(200)
  })
})
