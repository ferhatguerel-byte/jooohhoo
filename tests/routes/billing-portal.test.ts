import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { getCurrentUserMock, sessionsCreateMock } = vi.hoisted(() => ({
  getCurrentUserMock: vi.fn(),
  sessionsCreateMock: vi.fn(),
}))
vi.mock('@/lib/current-user', () => ({ getCurrentUser: getCurrentUserMock }))
vi.mock('@/lib/stripe', () => ({
  getStripe: () => ({ billingPortal: { sessions: { create: sessionsCreateMock } } }),
}))
vi.mock('@/lib/stripe-portal', () => ({ getLockedPortalConfigurationId: vi.fn().mockResolvedValue('cfg_locked') }))

import { POST } from '@/app/api/billing/portal/route'

function req() {
  return new NextRequest('http://localhost/api/billing/portal', { method: 'POST' })
}

describe('POST /api/billing/portal', () => {
  beforeEach(() => {
    getCurrentUserMock.mockReset()
    sessionsCreateMock.mockReset()
  })

  it('rejects unauthenticated requests', async () => {
    getCurrentUserMock.mockResolvedValue(null)
    const res = await POST(req())
    expect(res.status).toBe(401)
    expect(sessionsCreateMock).not.toHaveBeenCalled()
  })

  it('rejects a user without a Stripe customer id', async () => {
    getCurrentUserMock.mockResolvedValue({ id: 'u1', stripeCustomerId: null })
    const res = await POST(req())
    expect(res.status).toBe(404)
  })

  it('always uses the requesting user\'s own stripeCustomerId — never a client-supplied one', async () => {
    getCurrentUserMock.mockResolvedValue({ id: 'u1', stripeCustomerId: 'cus_own', subscriptionTier: 'monthly' })
    sessionsCreateMock.mockResolvedValue({ url: 'https://billing.stripe.com/session/abc' })
    const res = await POST(req())
    expect(res.status).toBe(200)
    expect(sessionsCreateMock).toHaveBeenCalledWith(expect.objectContaining({ customer: 'cus_own' }))
  })

  it('never leaks internal Stripe error details when session creation fails', async () => {
    getCurrentUserMock.mockResolvedValue({ id: 'u1', stripeCustomerId: 'cus_own', subscriptionTier: 'monthly' })
    sessionsCreateMock.mockRejectedValue(new Error('Stripe secret key sk_live_xxx invalid'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await POST(req())
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(JSON.stringify(body)).not.toContain('sk_live')
    spy.mockRestore()
  })
})
