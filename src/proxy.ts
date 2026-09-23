import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { REQUEST_ID_HEADER, resolveRequestId } from '@/lib/observability/request-id'

const SESSION_COOKIE = 'bp24_session'

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET
  if (secret) return new TextEncoder().encode(secret)

  if (process.env.NODE_ENV !== 'production') {
    return new TextEncoder().encode('dev-only-insecure-secret-change-me')
  }

  throw new Error(
    'SESSION_SECRET ist nicht gesetzt. In Production darf hierfür kein unsicherer Standardwert ' +
      'verwendet werden. Bitte die Umgebungsvariable in den Vercel-Projekteinstellungen setzen.'
  )
}

async function handleDashboardAuth(req: NextRequest): Promise<NextResponse> {
  const token = req.cookies.get(SESSION_COOKIE)?.value

  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  try {
    await jwtVerify(token, getSecret())
    return NextResponse.next()
  } catch {
    return NextResponse.redirect(new URL('/login', req.url))
  }
}

/**
 * Phase 4.4 (Teil F) – Request-ID für jeden API-Request. Ein vom Client mitgelieferter
 * `X-Request-ID`-Header wird nur übernommen, wenn er eine valide UUID ist (siehe
 * src/lib/observability/request-id.ts), sonst serverseitig neu erzeugt. Auf dem
 * WEITERGELEITETEN Request gesetzt (damit Route Handler ihn per `req.headers.get(...)` lesen
 * können, siehe getRequestId()) UND auf der Response (Client-sichtbarer `X-Request-ID`-Header).
 */
function withRequestId(req: NextRequest): NextResponse {
  const requestId = resolveRequestId(req.headers.get(REQUEST_ID_HEADER))

  const requestHeaders = new Headers(req.headers)
  requestHeaders.set(REQUEST_ID_HEADER, requestId)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set(REQUEST_ID_HEADER, requestId)
  return response
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (pathname.startsWith('/dashboard')) {
    return handleDashboardAuth(req)
  }

  if (pathname.startsWith('/api')) {
    return withRequestId(req)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*'],
}
