import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Phase 4.2 (Teil Y) – STRIPE_SECRET_KEY darf in Production nicht still auf einen
 * Platzhalter zurückfallen. Jeder Testfall importiert das Modul frisch (vi.resetModules()),
 * da getStripe() den Client-Singleton modulintern zwischenspeichert.
 */
describe('getStripe — Phase 4.2 (Teil Y)', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
  })

  it('wirft in Production ohne STRIPE_SECRET_KEY einen klaren Fehler statt eines stillen Platzhalters', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('STRIPE_SECRET_KEY', '')
    const { getStripe } = await import('@/lib/stripe')
    expect(() => getStripe()).toThrow(/STRIPE_SECRET_KEY/)
  })

  it('funktioniert in Production mit gesetztem STRIPE_SECRET_KEY', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_live_test')
    const { getStripe } = await import('@/lib/stripe')
    expect(() => getStripe()).not.toThrow()
  })

  it('verwendet außerhalb von Production weiterhin den Platzhalter, wenn kein Key gesetzt ist (Build/Dev/Test)', async () => {
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('STRIPE_SECRET_KEY', '')
    const { getStripe } = await import('@/lib/stripe')
    expect(() => getStripe()).not.toThrow()
  })

  /**
   * Regression: eine versehentlich als STRIPE_SECRET_KEY hinterlegte Publishable-Key-URL
   * (pk_...) führte bisher erst beim tatsächlichen Stripe-API-Call zu einem schwer zu
   * diagnostizierenden Fehler ("This API call cannot be made with a publishable API key").
   */
  it('wirft einen klaren Fehler, wenn STRIPE_SECRET_KEY versehentlich einen Publishable Key (pk_...) enthält', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('STRIPE_SECRET_KEY', 'pk_live_test')
    const { getStripe } = await import('@/lib/stripe')
    expect(() => getStripe()).toThrow(/Publishable Key/)
  })

  it('wirft denselben Fehler auch außerhalb von Production, wenn ein Publishable Key gesetzt ist', async () => {
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('STRIPE_SECRET_KEY', 'pk_test_test')
    const { getStripe } = await import('@/lib/stripe')
    expect(() => getStripe()).toThrow(/Publishable Key/)
  })
})
