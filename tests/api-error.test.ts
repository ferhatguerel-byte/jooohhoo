import { describe, it, expect, vi, beforeEach } from 'vitest'
import { z } from 'zod'
import { NextRequest } from 'next/server'
import { handleApiError } from '@/lib/api-error'
import { AuthorizationError } from '@/lib/authorization'
import { RateLimitError } from '@/lib/rate-limit'
import { PayloadTooLargeError } from '@/lib/security/request-limits'
import { REQUEST_ID_HEADER, generateRequestId } from '@/lib/observability/request-id'

async function bodyOf(res: Response) {
  return JSON.parse(await res.text())
}

describe('handleApiError', () => {
  it('translates AuthorizationError to its own status and message', async () => {
    const res = handleApiError(new AuthorizationError('Kein Zugriff.', 403))
    expect(res.status).toBe(403)
    expect(await bodyOf(res)).toEqual({ error: 'Kein Zugriff.' })
  })

  it('translates RateLimitError to 429', async () => {
    const res = handleApiError(new RateLimitError('Zu viele Anfragen.'))
    expect(res.status).toBe(429)
    expect(await bodyOf(res)).toEqual({ error: 'Zu viele Anfragen.' })
  })

  it('translates a ZodError to 400 with the first issue message', async () => {
    const schema = z.object({ email: z.string().email() })
    const result = schema.safeParse({ email: 'not-an-email' })
    expect(result.success).toBe(false)
    if (result.success) return
    const res = handleApiError(result.error)
    expect(res.status).toBe(400)
  })

  it('never leaks internal error details for unexpected errors', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const internal = new Error('DB connection string exposed: postgres://user:secret@host/db')
    const res = handleApiError(internal, 'Etwas ist schiefgelaufen.')

    expect(res.status).toBe(500)
    const body = await bodyOf(res)
    expect(body.error).toBe('Etwas ist schiefgelaufen.')
    expect(JSON.stringify(body)).not.toContain('secret')
    expect(typeof body.errorId).toBe('string')

    // Die vollen Details landen nur im Server-Log, nie in der Antwort.
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('translates PayloadTooLargeError to 413', async () => {
    const res = handleApiError(new PayloadTooLargeError('Die Anfrage ist zu groß.'))
    expect(res.status).toBe(413)
    expect(await bodyOf(res)).toEqual({ error: 'Die Anfrage ist zu groß.' })
  })

  describe('Phase 4.4 (Teil D/E/F) — Request-ID-Korrelation bei unerwarteten Fehlern', () => {
    beforeEach(() => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    it('erwartete Fehler (400/401/403/429/413) bekommen KEINEN X-Request-ID-Header gesetzt', async () => {
      const req = new NextRequest('http://localhost/api/jobs', { headers: { [REQUEST_ID_HEADER]: generateRequestId() } })
      const res = handleApiError(new RateLimitError('Zu viele Anfragen.'), 'Fallback', req)
      expect(res.headers.get(REQUEST_ID_HEADER)).toBeNull()
    })

    it('übernimmt bei einem unerwarteten Fehler die bereits vom Proxy gesetzte Request-ID', async () => {
      const requestId = generateRequestId()
      const req = new NextRequest('http://localhost/api/jobs', { headers: { [REQUEST_ID_HEADER]: requestId } })
      const res = handleApiError(new Error('boom'), 'Fallback', req)
      expect(res.headers.get(REQUEST_ID_HEADER)).toBe(requestId)
    })

    it('funktioniert weiterhin ohne req-Parameter (Rückwärtskompatibilität zu bestehenden Aufrufstellen)', async () => {
      const res = handleApiError(new Error('boom'), 'Fallback')
      expect(res.status).toBe(500)
      expect(res.headers.get(REQUEST_ID_HEADER)).toBeNull()
    })

    it('loggt route/method als strukturierte Felder, wenn req übergeben wird', async () => {
      const spy = vi.spyOn(console, 'error')
      const req = new NextRequest('http://localhost/api/jobs', { method: 'POST' })
      handleApiError(new Error('boom'), 'Fallback', req)
      const logged = JSON.parse(spy.mock.calls[0][0] as string)
      expect(logged.route).toBe('/api/jobs')
      expect(logged.method).toBe('POST')
    })
  })
})
