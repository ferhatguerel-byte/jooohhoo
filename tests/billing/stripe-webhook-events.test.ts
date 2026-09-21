import { describe, it, expect, vi } from 'vitest'
import { claimStripeEvent, markStripeEventProcessed, markStripeEventFailed } from '@/lib/billing/stripe-webhook-events'

describe('claimStripeEvent — Phase 4.2 (Teil B/C)', () => {
  it('INSERT gewinnt (rowCount 1) -> claimed: true', async () => {
    const query = vi.fn().mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'x' }] })
    const result = await claimStripeEvent({ query }, 'evt_1', 'checkout.session.completed', 1000)
    expect(result).toEqual({ claimed: true })
    expect(query.mock.calls[0][0]).toContain('ON CONFLICT (stripe_event_id) DO NOTHING')
  })

  it('bereits "processed" -> claimed: false, reason: already_processed', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ status: 'processed' }] })
    const result = await claimStripeEvent({ query }, 'evt_2', 'checkout.session.completed', 1000)
    expect(result).toEqual({ claimed: false, reason: 'already_processed' })
  })

  it('bereits "processing" -> claimed: false, reason: in_progress', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ status: 'processing' }] })
    const result = await claimStripeEvent({ query }, 'evt_3', 'checkout.session.completed', 1000)
    expect(result).toEqual({ claimed: false, reason: 'in_progress' })
  })

  it('"failed" -> Reclaim-UPDATE gewinnt -> claimed: true', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ status: 'failed' }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'x' }] })
    const result = await claimStripeEvent({ query }, 'evt_4', 'checkout.session.completed', 1000)
    expect(result).toEqual({ claimed: true })
  })

  it('"failed" -> Reclaim-UPDATE verliert gegen einen parallelen Reclaim -> claimed: false', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ status: 'failed' }] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
    const result = await claimStripeEvent({ query }, 'evt_5', 'checkout.session.completed', 1000)
    expect(result).toEqual({ claimed: false, reason: 'in_progress' })
  })
})

describe('markStripeEventProcessed / markStripeEventFailed', () => {
  it('markStripeEventProcessed setzt status=processed', async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 1, rows: [] })
    await markStripeEventProcessed({ query }, 'evt_1')
    expect(query.mock.calls[0][0]).toContain("status = 'processed'")
  })

  it('markStripeEventFailed kürzt die Fehlermeldung auf max. 500 Zeichen (keine Secrets/Payloads dauerhaft)', async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 1, rows: [] })
    const longMessage = 'x'.repeat(1000)
    await markStripeEventFailed({ query }, 'evt_1', longMessage)
    const params = query.mock.calls[0][1] as unknown[]
    expect((params[1] as string).length).toBe(500)
  })
})
