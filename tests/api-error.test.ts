import { describe, it, expect, vi } from 'vitest'
import { z } from 'zod'
import { handleApiError } from '@/lib/api-error'
import { AuthorizationError } from '@/lib/authorization'
import { RateLimitError } from '@/lib/rate-limit'

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
})
