import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { AuthorizationError } from '@/lib/authorization'
import { RateLimitError } from '@/lib/rate-limit'
import { PayloadTooLargeError } from '@/lib/security/request-limits'
import { captureError } from '@/lib/observability/sentry'
import { getRequestId, REQUEST_ID_HEADER } from '@/lib/observability/request-id'

/**
 * Einheitliche Fehlerbehandlung für alle API Route Handler.
 *
 * - Erwartete Fehler (Validierung, Autorisierung, Rate-Limit, Payload-zu-groß) werden mit ihrer
 *   eigenen, für Nutzer verständlichen Nachricht und dem passenden HTTP-Status beantwortet –
 *   das ist normales API-Verhalten (Phase 4.4 Teil D: 400/401/403/404/409/413/429) und wird NICHT
 *   an das Error-Tracking gemeldet.
 * - Unerwartete Fehler (alles andere – DB-Verbindungsfehler, Stripe-SDK-Fehler, Bugs) werden NICHT
 *   im Klartext an den Client geschickt (keine internen Stacktraces/DB-Fehlermeldungen/SQL) –
 *   stattdessen eine generische Nachricht plus eine Fehler-ID, die serverseitig strukturiert
 *   geloggt UND an das zentrale Error-Tracking gemeldet wird (Phase 4.4 Teil B/D, No-op ohne
 *   SENTRY_DSN, siehe src/lib/observability/sentry.ts).
 *
 * `req` ist optional (Rückwärtskompatibilität zu allen bestehenden Aufrufstellen) – wird es
 * übergeben, fließt die bereits vom Proxy gesetzte Request-ID (Teil F) als Korrelations-Tag ins
 * Error-Tracking und in die Log-Zeile ein.
 *
 * Verwendung in einer Route:
 *   } catch (err) {
 *     return handleApiError(err, 'Auftrag konnte nicht erstellt werden.', req)
 *   }
 */
export function handleApiError(err: unknown, fallbackMessage = 'Ein Fehler ist aufgetreten.', req?: NextRequest): NextResponse {
  if (err instanceof AuthorizationError) {
    return NextResponse.json({ error: err.message }, { status: err.status })
  }
  if (err instanceof RateLimitError) {
    return NextResponse.json({ error: err.message }, { status: 429 })
  }
  if (err instanceof PayloadTooLargeError) {
    return NextResponse.json({ error: err.message }, { status: 413 })
  }
  if (err instanceof z.ZodError) {
    return NextResponse.json({ error: err.issues[0]?.message || 'Ungültige Eingabe.' }, { status: 400 })
  }

  const errorId = randomUUID()
  const message = err instanceof Error ? err.message : String(err)
  const requestId = req ? getRequestId(req) : undefined
  const route = req?.nextUrl?.pathname
  const method = req?.method

  console.error(
    JSON.stringify({
      event: 'api_unexpected_error',
      level: 'error',
      errorId,
      requestId,
      route,
      method,
      message: fallbackMessage,
      timestamp: new Date().toISOString(),
    }),
    '—',
    message
  )
  captureError(err, { requestId, route, method, extra: { errorId, fallbackMessage } })

  const response = NextResponse.json({ error: fallbackMessage, errorId }, { status: 500 })
  if (requestId) response.headers.set(REQUEST_ID_HEADER, requestId)
  return response
}
