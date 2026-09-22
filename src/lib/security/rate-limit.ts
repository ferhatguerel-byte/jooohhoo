import { enforceRateLimit } from '@/lib/rate-limit'

/**
 * Phase 4.3 (Teil B) – zentrale, ergonomische Rate-Limit-Fassade für neue Aufrufstellen.
 *
 * Baut BEWUSST auf der bestehenden, bereits DB-gestützten Implementierung in
 * `src/lib/rate-limit.ts` auf (Tabelle `rate_limit_hits`, seit Phase 1 im Einsatz für Login/
 * Registrierung/Passwort-vergessen/Upload) – keine zweite, konkurrierende Counter-Logik. Diese
 * Fassade bietet nur die im Auftrag gewünschte `{ key, limit, windowSeconds }`-Signatur, damit
 * neue Routen nicht jedes Mal Bucket/Identifier/Minuten-Umrechnung von Hand auseinanderklamüsern
 * müssen.
 *
 * `key`-Konvention: `"<bucket>:<identifier>"`, z.B. `"jobs:create:${user.id}"` oder
 * `"support:ticket:${getClientIp(req)}"`. Der Teil vor dem ersten `:` wird als `bucket` an die
 * zugrunde liegende Tabelle durchgereicht (für spätere Auswertung/Aufräumen nach Bucket), der Rest
 * als `identifier`. Enthält `key` keinen `:`, wird derselbe String für beides verwendet.
 *
 * Granularität: `rate_limit_hits` zählt in Minutenfenstern (siehe `checkRateLimit`). Ein
 * `windowSeconds < 60` wird auf 1 Minute aufgerundet – für Sub-Minuten-Fenster ist diese
 * DB-gestützte Lösung ohnehin nicht gedacht (dafür wäre ein In-Memory-/Edge-Limiter nötig, den
 * diese Phase nicht einführt, siehe Scope).
 *
 * Wirft `RateLimitError` (aus `src/lib/rate-limit.ts`), die `handleApiError` bereits als 429
 * behandelt – keine neue Fehlerklasse nötig.
 */
export interface RateLimitOptions {
  key: string
  limit: number
  windowSeconds: number
  message?: string
}

export async function rateLimit(opts: RateLimitOptions): Promise<void> {
  const separatorIndex = opts.key.indexOf(':')
  const bucket = separatorIndex === -1 ? opts.key : opts.key.slice(0, separatorIndex)
  const identifier = separatorIndex === -1 ? opts.key : opts.key.slice(separatorIndex + 1)
  const windowMinutes = Math.max(1, Math.ceil(opts.windowSeconds / 60))

  await enforceRateLimit(bucket, identifier, opts.limit, windowMinutes, opts.message)
}

export { getClientIp } from '@/lib/rate-limit'
