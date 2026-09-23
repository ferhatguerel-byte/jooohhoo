import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { proxy } from '@/proxy'
import { REQUEST_ID_HEADER, isValidRequestId, generateRequestId } from '@/lib/observability/request-id'

function apiReq(path: string, headers: Record<string, string> = {}) {
  return new NextRequest(`http://localhost${path}`, { headers })
}

describe('proxy — Phase 4.4 (Teil F) Request-ID für API-Requests', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  it('setzt einen X-Request-ID-Response-Header für /api/*, wenn der Client keinen mitschickt', async () => {
    const res = await proxy(apiReq('/api/jobs'))
    const id = res.headers.get(REQUEST_ID_HEADER)
    expect(isValidRequestId(id)).toBe(true)
  })

  it('übernimmt eine valide, vom Client mitgelieferte Request-ID', async () => {
    const clientId = generateRequestId()
    const res = await proxy(apiReq('/api/jobs', { [REQUEST_ID_HEADER]: clientId }))
    expect(res.headers.get(REQUEST_ID_HEADER)).toBe(clientId)
  })

  it('verwirft eine ungültige/manipulierte Client-Request-ID und erzeugt eine neue', async () => {
    const res = await proxy(apiReq('/api/jobs', { [REQUEST_ID_HEADER]: '<script>alert(1)</script>' }))
    const id = res.headers.get(REQUEST_ID_HEADER)
    expect(isValidRequestId(id)).toBe(true)
    expect(id).not.toBe('<script>alert(1)</script>')
  })

  it('leitet die Request-ID auch auf dem weitergeleiteten Request weiter (für Route Handler lesbar)', async () => {
    const res = await proxy(apiReq('/api/jobs'))
    const forwardedRequestHeaders = res.headers.get('x-middleware-request-x-request-id')
    // Next.js kodiert die per NextResponse.next({request:{headers}}) gesetzten Request-Header als
    // x-middleware-request-* Response-Header (internes Next.js-Protokoll für Proxy -> Handler).
    expect(forwardedRequestHeaders).toBeTruthy()
    expect(forwardedRequestHeaders).toBe(res.headers.get(REQUEST_ID_HEADER))
  })

  it('lässt Nicht-API/Nicht-Dashboard-Pfade unverändert durch (kein Request-ID-Overhead)', async () => {
    const res = await proxy(apiReq('/impressum'))
    expect(res.headers.get(REQUEST_ID_HEADER)).toBeNull()
  })
})

describe('proxy — bestehende Dashboard-Auth bleibt unverändert', () => {
  it('leitet einen nicht angemeldeten Dashboard-Aufruf weiterhin zu /login um', async () => {
    const res = await proxy(apiReq('/dashboard/jobs'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/login')
  })
})
