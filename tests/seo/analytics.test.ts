import { describe, it, expect, vi } from 'vitest'
import { track, ANALYTICS_EVENTS } from '@/lib/analytics'

describe('analytics.track()', () => {
  it('enthält genau die in Phase 2.1 geforderten Mindest-Events', () => {
    const values = Object.values(ANALYTICS_EVENTS)
    expect(values).toEqual(
      expect.arrayContaining([
        'seo_landing_view',
        'provider_profile_view',
        'project_cta_click',
        'project_created',
        'provider_contact',
        'offer_received',
        'offer_opened',
        'offer_accepted',
      ])
    )
  })

  it('wirft niemals, selbst wenn das Payload ungewöhnliche Werte enthält', () => {
    expect(() => track(ANALYTICS_EVENTS.SEO_LANDING_VIEW, { a: 1, b: 'x', c: true, d: undefined })).not.toThrow()
  })

  it('wirft nicht, wenn console.log selbst einen Fehler auslöst (darf Kernfunktion nie stören)', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {
      throw new Error('boom')
    })
    expect(() => track(ANALYTICS_EVENTS.PROJECT_CREATED, { jobId: 'j1' })).not.toThrow()
    spy.mockRestore()
  })
})
