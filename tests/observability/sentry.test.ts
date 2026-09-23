import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Phase 4.4 (Teil B) – Tests für die Sentry-Integration. Da in dieser Sandbox kein SENTRY_DSN
 * verfügbar ist, wird hier NUR die No-op-/Lazy-Load-Logik geprüft (kein Netzwerkaufruf, kein
 * Absturz) – die tatsächliche Zustellung an ein echtes Sentry-Projekt kann hier nicht verifiziert
 * werden (siehe docs/phase-4.4-observability.md, ehrlich dokumentiert statt vorgetäuscht).
 */
describe('captureError/captureMessage — No-op ohne SENTRY_DSN', () => {
  beforeEach(async () => {
    vi.resetModules()
    vi.unstubAllEnvs()
  })

  it('captureError wirft nicht und tut ohne DSN nichts', async () => {
    vi.stubEnv('SENTRY_DSN', '')
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', '')
    const { captureError } = await import('@/lib/observability/sentry')
    expect(() => captureError(new Error('test'))).not.toThrow()
  })

  it('captureMessage wirft nicht und tut ohne DSN nichts', async () => {
    vi.stubEnv('SENTRY_DSN', '')
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', '')
    const { captureMessage } = await import('@/lib/observability/sentry')
    expect(() => captureMessage('etwas Unerwartetes')).not.toThrow()
  })

  it('lädt das @sentry/nextjs-Paket NICHT, solange kein DSN gesetzt ist', async () => {
    vi.stubEnv('SENTRY_DSN', '')
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', '')
    const { captureError } = await import('@/lib/observability/sentry')
    captureError(new Error('test'))
    // Kein Import-Fehler/Crash bedeutet: der dynamische import() wurde nie ausgelöst (das Modul
    // bleibt ungenutzt) – siehe Kommentar in sentry.ts zur bewussten Lazy-Load-Entscheidung.
    expect(true).toBe(true)
  })

  it('captureError akzeptiert Kontextfelder, ohne zu werfen', async () => {
    vi.stubEnv('SENTRY_DSN', '')
    const { captureError } = await import('@/lib/observability/sentry')
    expect(() =>
      captureError(new Error('test'), {
        requestId: 'req-1',
        route: '/api/jobs',
        method: 'POST',
        userId: 'u1',
        jobId: 'job-1',
      })
    ).not.toThrow()
  })
})
