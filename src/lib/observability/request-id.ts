import { randomUUID } from 'crypto'
import type { NextRequest } from 'next/server'

export const REQUEST_ID_HEADER = 'x-request-id'

// Standard-UUID (v1-v5, wie von crypto.randomUUID() erzeugt) – akzeptiert auch von einem
// vorgelagerten Proxy/Load-Balancer gesetzte UUIDs, lehnt aber alles andere ab.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Phase 4.4 (Teil F) – zentrale Request-ID-Utility. Keine bestehende Request-ID-Infrastruktur im
 * Repo gefunden.
 *
 * Ein Client (oder ein vorgelagerter Proxy) KANN bereits einen `X-Request-ID`-Header mitschicken
 * (nützlich, wenn CDN/Load-Balancer bereits eine ID vergibt) – aber nicht blind übernehmen: nur
 * eine syntaktisch valide UUID wird akzeptiert, alles andere (leer, zu lang, Steuerzeichen,
 * absichtlich manipulierter Wert) wird verworfen und serverseitig neu erzeugt.
 */
export function isValidRequestId(value: string | null | undefined): value is string {
  return !!value && UUID_PATTERN.test(value)
}

export function generateRequestId(): string {
  return randomUUID()
}

/** Übernimmt einen vom Client mitgelieferten Wert nur, wenn er eine valide UUID ist. */
export function resolveRequestId(clientProvided: string | null | undefined): string {
  return isValidRequestId(clientProvided) ? clientProvided : generateRequestId()
}

/** Liest die (vom Proxy bereits gesetzte) Request-ID aus einem eingehenden Request. Fällt auf
 * eine neu erzeugte ID zurück, falls die Route außerhalb des Proxy-Matchers aufgerufen wird
 * (z.B. in einem Unit-Test ohne Proxy-Durchlauf) – nie `undefined`. */
export function getRequestId(req: Pick<NextRequest, 'headers'>): string {
  return resolveRequestId(req.headers.get(REQUEST_ID_HEADER))
}
