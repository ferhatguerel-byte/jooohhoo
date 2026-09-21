import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  mapStripeSubscriptionStatus,
  resolveTierFromSubscription,
  applyCheckoutActivation,
  applySubscriptionUpdated,
  applySubscriptionDeleted,
} from '@/lib/billing/subscription-state'
import type Stripe from 'stripe'

describe('mapStripeSubscriptionStatus — Phase 4.2 (Teil E)', () => {
  it('active -> active', () => {
    expect(mapStripeSubscriptionStatus('active')).toBe('active')
  })
  it('past_due -> past_due', () => {
    expect(mapStripeSubscriptionStatus('past_due')).toBe('past_due')
  })
  for (const s of ['trialing', 'unpaid', 'incomplete', 'incomplete_expired', 'canceled', 'paused'] as const) {
    it(`${s} -> inactive (bestehende Buckets, keine neue Policy)`, () => {
      expect(mapStripeSubscriptionStatus(s)).toBe('inactive')
    })
  }
})

describe('resolveTierFromSubscription — Phase 4.2 (Teil G)', () => {
  beforeEach(() => {
    vi.stubEnv('STRIPE_PRICE_MONTHLY', 'price_monthly')
    vi.stubEnv('STRIPE_PRICE_YEARLY', 'price_yearly')
  })

  function sub(priceId: string | undefined, metaTier?: string): Stripe.Subscription {
    return {
      items: { data: priceId ? [{ price: { id: priceId } }] : [] },
      metadata: metaTier ? { tier: metaTier } : {},
    } as unknown as Stripe.Subscription
  }

  it('erkennt STRIPE_PRICE_MONTHLY als "monthly"', () => {
    expect(resolveTierFromSubscription(sub('price_monthly'))).toBe('monthly')
  })
  it('erkennt STRIPE_PRICE_YEARLY als "yearly"', () => {
    expect(resolveTierFromSubscription(sub('price_yearly'))).toBe('yearly')
  })
  it('unbekannte Price-ID fällt auf metadata.tier zurück', () => {
    expect(resolveTierFromSubscription(sub('price_something_else', 'yearly'))).toBe('yearly')
  })
  it('unbekannte Price-ID ohne Metadata-Fallback liefert null (kein Raten)', () => {
    expect(resolveTierFromSubscription(sub('price_something_else'))).toBeNull()
  })
  it('keine Price-Items, aber gültiges metadata.tier -> Fallback greift', () => {
    expect(resolveTierFromSubscription(sub(undefined, 'monthly'))).toBe('monthly')
  })
  it('weder Price noch Metadata auflösbar -> null', () => {
    expect(resolveTierFromSubscription(sub(undefined))).toBeNull()
  })
})

describe('Ordering-Guard-Updates — Phase 4.2 (Teil D)', () => {
  it('applyCheckoutActivation: WHERE-Klausel enthält den Ordering-Guard', async () => {
    const queryMock = vi.fn().mockResolvedValue({ rowCount: 1 })
    const applied = await applyCheckoutActivation(
      { query: queryMock },
      {
        userId: 'u1',
        tier: 'monthly',
        stripeSubscriptionId: 'sub_1',
        stripeCustomerId: 'cus_1',
        minimumTermMonths: 0,
        eventCreatedAt: new Date(1000),
      }
    )
    expect(applied).toBe(true)
    expect(queryMock.mock.calls[0][0]).toContain('subscription_state_updated_at IS NULL OR subscription_state_updated_at <')
  })

  it('applyCheckoutActivation: rowCount 0 (veraltetes Event) -> applied=false, kein Fehler', async () => {
    const queryMock = vi.fn().mockResolvedValue({ rowCount: 0 })
    const applied = await applyCheckoutActivation(
      { query: queryMock },
      { userId: 'u1', tier: 'monthly', stripeSubscriptionId: 'sub_1', stripeCustomerId: 'cus_1', minimumTermMonths: 0, eventCreatedAt: new Date(1000) }
    )
    expect(applied).toBe(false)
  })

  it('applySubscriptionUpdated: tier=null nutzt COALESCE (bestehenden Tier behalten)', async () => {
    const queryMock = vi.fn().mockResolvedValue({ rowCount: 1 })
    await applySubscriptionUpdated(
      { query: queryMock },
      { userId: 'u1', status: 'active', tier: null, cancelAt: null, eventCreatedAt: new Date(1000) }
    )
    expect(queryMock.mock.calls[0][1]).toContain(null)
    expect(queryMock.mock.calls[0][0]).toContain('COALESCE($2, subscription_tier)')
  })

  it('applySubscriptionDeleted: setzt canceled + cancel_at NULL mit Ordering-Guard', async () => {
    const queryMock = vi.fn().mockResolvedValue({ rowCount: 1 })
    const applied = await applySubscriptionDeleted({ query: queryMock }, { userId: 'u1', eventCreatedAt: new Date(1000) })
    expect(applied).toBe(true)
    expect(queryMock.mock.calls[0][0]).toContain("subscription_status = 'canceled'")
    expect(queryMock.mock.calls[0][0]).toContain('subscription_state_updated_at <')
  })

  it('rowCount null (pg kann das liefern) wird sicher als "nicht angewendet" behandelt', async () => {
    const queryMock = vi.fn().mockResolvedValue({ rowCount: null })
    const applied = await applySubscriptionDeleted({ query: queryMock }, { userId: 'u1', eventCreatedAt: new Date(1000) })
    expect(applied).toBe(false)
  })
})
