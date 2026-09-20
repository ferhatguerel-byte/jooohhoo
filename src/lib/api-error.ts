import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { AuthorizationError } from '@/lib/authorization'
import { RateLimitError } from '@/lib/rate-limit'

/**
 * Einheitliche Fehlerbehandlung für alle API Route Handler.
 *
 * - Erwartete Fehler (Validierung, Autorisierung, Rate-Limit) werden mit ihrer eigenen,
 *   für Nutzer verständlichen Nachricht und dem passenden HTTP-Status beantwortet.
 * - Unerwartete Fehler werden NICHT im Klartext an den Client geschickt (keine internen
 *   Stacktraces/DB-Fehlermeldungen) – stattdessen eine generische Nachricht plus eine
 *   Fehler-ID, die serverseitig geloggt wird und im Support-Fall zur Zuordnung dient.
 *
 * Verwendung in einer Route:
 *   } catch (err) {
 *     return handleApiError(err, 'Auftrag konnte nicht erstellt werden.')
 *   }
 */
export function handleApiError(err: unknown, fallbackMessage = 'Ein Fehler ist aufgetreten.'): NextResponse {
  if (err instanceof AuthorizationError) {
    return NextResponse.json({ error: err.message }, { status: err.status })
  }
  if (err instanceof RateLimitError) {
    return NextResponse.json({ error: err.message }, { status: 429 })
  }
  if (err instanceof z.ZodError) {
    return NextResponse.json({ error: err.issues[0]?.message || 'Ungültige Eingabe.' }, { status: 400 })
  }

  const errorId = randomUUID()
  const message = err instanceof Error ? err.message : String(err)
  console.error(`[${errorId}] ${fallbackMessage} —`, message)
  return NextResponse.json({ error: fallbackMessage, errorId }, { status: 500 })
}
