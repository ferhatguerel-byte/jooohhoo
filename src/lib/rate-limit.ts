import type { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'

/** Wird von handleApiError (src/lib/api-error.ts) in eine 429-Antwort übersetzt. */
export class RateLimitError extends Error {
  constructor(message = 'Zu viele Anfragen. Bitte versuchen Sie es später erneut.') {
    super(message)
    this.name = 'RateLimitError'
  }
}

export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]!.trim()
  return req.headers.get('x-real-ip') || 'unknown'
}

/**
 * Erlaubt maximal `maxHits` Aktionen innerhalb von `windowMinutes` Minuten für einen
 * bestimmten Bucket+Identifier (z.B. Login-Versuche pro IP+E-Mail). Gibt false zurück,
 * wenn das Limit bereits erreicht ist – die Aktion selbst wird dann nicht gezählt.
 */
export async function checkRateLimit(
  bucket: string,
  identifier: string,
  maxHits: number,
  windowMinutes: number
): Promise<boolean> {
  const db = getDb()

  const result = await db.query(
    `SELECT COUNT(*)::int AS count FROM rate_limit_hits
     WHERE bucket = $1 AND identifier = $2 AND created_at > now() - make_interval(mins => $3)`,
    [bucket, identifier, windowMinutes]
  )
  if (result.rows[0].count >= maxHits) {
    return false
  }

  await db.query('INSERT INTO rate_limit_hits (bucket, identifier) VALUES ($1, $2)', [bucket, identifier])

  // Beiläufiges Aufräumen alter Einträge, damit die Tabelle nicht unbegrenzt wächst.
  if (Math.random() < 0.05) {
    db.query("DELETE FROM rate_limit_hits WHERE created_at < now() - interval '1 day'").catch(() => {})
  }

  return true
}

/** Wie checkRateLimit, wirft aber RateLimitError statt false zurückzugeben. */
export async function enforceRateLimit(
  bucket: string,
  identifier: string,
  maxHits: number,
  windowMinutes: number,
  message?: string
): Promise<void> {
  const allowed = await checkRateLimit(bucket, identifier, maxHits, windowMinutes)
  if (!allowed) throw new RateLimitError(message)
}
