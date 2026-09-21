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
})
