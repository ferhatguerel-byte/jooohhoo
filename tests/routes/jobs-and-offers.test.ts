import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { getCurrentUserMock, queryMock, connectMock } = vi.hoisted(() => ({
  getCurrentUserMock: vi.fn(),
  queryMock: vi.fn(),
  connectMock: vi.fn(),
}))
vi.mock('@/lib/current-user', () => ({ getCurrentUser: getCurrentUserMock }))
vi.mock('@/lib/db', () => ({ getDb: () => ({ query: queryMock, connect: connectMock }) }))
vi.mock('@/lib/email', () => ({ sendNewOfferEmail: vi.fn() }))

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
