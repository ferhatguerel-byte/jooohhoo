import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Phase 5 – DATABASE_URL folgte bisher (anders als SESSION_SECRET/NEXT_PUBLIC_APP_URL/
 * CRON_SECRET/STRIPE_SECRET_KEY, siehe tests/billing/stripe-client.test.ts) keinem
 * fail-closed-Muster: ohne gesetzte Variable fiel getDb() in Production still auf eine
 * lokale Entwicklungs-Datenbank zurück, statt klar zu scheitern.
 */
describe('getDb – Production fail-closed', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
  })

  it('wirft in Production ohne DATABASE_URL statt still auf eine lokale Dev-DB zurückzufallen', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('DATABASE_URL', '')
    const { getDb } = await import('@/lib/db')
    expect(() => getDb()).toThrow(/DATABASE_URL ist nicht gesetzt/)
  })

  it('fällt außerhalb von Production weiterhin auf die lokale Dev-DB zurück', async () => {
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('DATABASE_URL', '')
    const { getDb } = await import('@/lib/db')
    expect(() => getDb()).not.toThrow()
  })

  it('verwendet DATABASE_URL, wenn gesetzt, unabhängig von NODE_ENV', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('DATABASE_URL', 'postgres://user:pass@example.com:5432/db')
    const { getDb } = await import('@/lib/db')
    expect(() => getDb()).not.toThrow()
  })
})
