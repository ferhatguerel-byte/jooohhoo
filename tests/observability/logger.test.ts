import { describe, it, expect, vi, beforeEach } from 'vitest'

const { captureErrorMock, captureMessageMock } = vi.hoisted(() => ({
  captureErrorMock: vi.fn(),
  captureMessageMock: vi.fn(),
}))
vi.mock('@/lib/observability/sentry', () => ({
  captureError: captureErrorMock,
  captureMessage: captureMessageMock,
}))

import { logEvent, redact } from '@/lib/observability/logger'

describe('redact — Phase 4.4 (Teil E) PII/Secret-Schutz', () => {
  it('entfernt bekannte gefährliche Feldnamen', () => {
    const result = redact({
      password: 'geheim',
      token: 'abc',
      sessionCookie: 'xyz',
      jwt: 'eyJ...',
      apiKey: 'sk-...',
      cronSecret: 'shh',
      email: 'user@example.com',
    } as Record<string, string>)
    expect(result.password).toBe('[redacted]')
    expect(result.token).toBe('[redacted]')
    expect(result.sessionCookie).toBe('[redacted]')
    expect(result.jwt).toBe('[redacted]')
    expect(result.apiKey).toBe('[redacted]')
    expect(result.cronSecret).toBe('[redacted]')
    expect(result.email).toBe('[redacted]')
  })

  it('lässt unkritische Felder unverändert', () => {
    const result = redact({ jobId: 'job-1', requestId: 'req-1', errorCode: 'ETIMEDOUT' })
    expect(result).toEqual({ jobId: 'job-1', requestId: 'req-1', errorCode: 'ETIMEDOUT' })
  })

  it('erkennt Varianten mit Unterstrichen/Bindestrichen (case-insensitive)', () => {
    const result = redact({ PASSWORD_HASH: 'x', 'reset-token': 'y', BLOB_READ_WRITE_TOKEN: 'z' } as Record<string, string>)
    expect(result.PASSWORD_HASH).toBe('[redacted]')
    expect(result['reset-token']).toBe('[redacted]')
    expect(result.BLOB_READ_WRITE_TOKEN).toBe('[redacted]')
  })
})

describe('logEvent — Phase 4.4 (Teil G)', () => {
  beforeEach(() => {
    captureErrorMock.mockReset()
    captureMessageMock.mockReset()
  })

  it('schreibt eine einzelne strukturierte JSON-Zeile über console.error bei level "error"', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    logEvent('stripe_webhook_failed', 'error', { stripeEventId: 'evt_1', eventType: 'invoice.payment_failed' })
    expect(spy).toHaveBeenCalledTimes(1)
    const logged = JSON.parse(spy.mock.calls[0][0] as string)
    expect(logged.event).toBe('stripe_webhook_failed')
    expect(logged.level).toBe('error')
    expect(logged.stripeEventId).toBe('evt_1')
    expect(typeof logged.timestamp).toBe('string')
    spy.mockRestore()
  })

  it('nutzt console.warn bei level "warn" und console.log bei "info"', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    logEvent('some_warning', 'warn', {})
    logEvent('some_info', 'info', {})
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(logSpy).toHaveBeenCalledTimes(1)
    warnSpy.mockRestore()
    logSpy.mockRestore()
  })

  it('meldet level "error" zusätzlich ans Error-Tracking (mit Exception)', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const err = new Error('DB down')
    logEvent('match_email_retry_batch_failed', 'error', { requestId: 'req-1' }, err)
    expect(captureErrorMock).toHaveBeenCalledWith(err, expect.objectContaining({ requestId: 'req-1' }))
    expect(captureMessageMock).not.toHaveBeenCalled()
  })

  it('meldet level "error" ohne Exception über captureMessage', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    logEvent('health_check_db_failed', 'error', { operation: 'health_check' })
    expect(captureMessageMock).toHaveBeenCalledWith('health_check_db_failed', expect.objectContaining({ operation: 'health_check' }))
    expect(captureErrorMock).not.toHaveBeenCalled()
  })

  it('meldet "info"/"warn" NICHT ans Error-Tracking (nur echte Fehler)', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    logEvent('routine_info', 'info', {})
    logEvent('routine_warning', 'warn', {})
    expect(captureErrorMock).not.toHaveBeenCalled()
    expect(captureMessageMock).not.toHaveBeenCalled()
  })

  it('redigiert Felder VOR dem Loggen (kein Secret in der JSON-Zeile)', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    logEvent('some_error', 'error', { token: 'super-secret-value', jobId: 'job-1' })
    const logged = spy.mock.calls[0][0] as string
    expect(logged).not.toContain('super-secret-value')
    expect(logged).toContain('job-1')
    spy.mockRestore()
  })

  it('wirft niemals, selbst wenn console/Sentry intern werfen', () => {
    captureErrorMock.mockImplementation(() => {
      throw new Error('sentry broke')
    })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => logEvent('x', 'error', {}, new Error('y'))).not.toThrow()
    spy.mockRestore()
  })
})
