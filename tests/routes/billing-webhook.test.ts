import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const queryMock = vi.fn()
vi.mock('@/lib/db', () => ({ getDb: () => ({ query: queryMock }) }))

const constructEventMock = vi.fn()
vi.mock('@/lib/stripe', () => ({
  getStripe: () => ({ webhooks: { constructEvent: constructEventMock } }),
}))

import { POST } from '@/app/api/billing/webhook/route'

function webhookReq(body: string, signature?: string) {
  const headers = new Headers()
  if (signature) headers.set('stripe-signature', signature)
  return new NextRequest('http://localhost/api/billing/webhook', { method: 'POST', body, headers })
}

describe('POST /api/billing/webhook', () => {
  beforeEach(() => {
    queryMock.mockReset()
    constructEventMock.mockReset()
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_test')
  })

  it('rejects a request without a Stripe signature header', async () => {
    const res = await POST(webhookReq('{}'))
    expect(res.status).toBe(500)
  })

  it('rejects a request with an invalid signature (forged webhook)', async () => {
    constructEventMock.mockImplementation(() => {
      throw new Error('signature mismatch')
    })
    const res = await POST(webhookReq('{}', 'sig_invalid'))
    expect(res.status).toBe(400)
  })

  it('activates the subscription on a valid checkout.session.completed event', async () => {
    constructEventMock.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          metadata: { userId: 'u1', tier: 'monthly' },
          subscription: 'sub_123',
          customer: 'cus_123',
        },
      },
    })
    queryMock.mockResolvedValue({})

    const res = await POST(webhookReq('{}', 'sig_valid'))
    expect(res.status).toBe(200)
    expect(queryMock).toHaveBeenCalledOnce()
  })
})
