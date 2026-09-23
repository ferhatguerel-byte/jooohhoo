import { captureError, captureMessage, type ErrorContext } from '@/lib/observability/sentry'

/**
 * Phase 4.4 (Teil G/E) – strukturierte, zentrale Logging-Funktion für kritische Produktionspfade
 * (Stripe-Webhook, Cron/Matching-Retry, Resend, Anthropic, Matching-Pipeline). Ersetzt unkontrolliertes
 * `console.log("etwas fehlgeschlagen", objekt)` durch ein einziges JSON-Objekt pro Zeile – von
 * jedem Log-Aggregator (Vercel Log Drains, Datadog, etc.) maschinell auswertbar.
 *
 * `level: 'error'` wird zusätzlich an Sentry weitergereicht (siehe src/lib/observability/sentry.ts,
 * No-op ohne SENTRY_DSN) – EIN Aufruf deckt sowohl strukturiertes Logging als auch Error-Tracking
 * ab, statt zwei getrennte Aufrufe an jeder Stelle zu pflegen.
 *
 * PII/Secret-Schutz (Teil E): `redact()` entfernt bekannte gefährliche Feldnamen aus den `fields`
 * defensiv, BEVOR geloggt wird – Verteidigung in der Tiefe zusätzlich zur Disziplin an den
 * Aufrufstellen (die ohnehin nie ganze Payloads/Secrets übergeben sollen).
 */
export type LogLevel = 'info' | 'warn' | 'error'

export interface LogFields {
  requestId?: string
  route?: string
  method?: string
  userId?: string
  role?: string
  jobId?: string
  offerId?: string
  notificationId?: string
  stripeEventId?: string
  eventType?: string
  operation?: string
  errorCode?: string
  errorId?: string
  [key: string]: string | number | boolean | null | undefined
}

const DENYLIST = [
  'password',
  'passwordhash',
  'password_hash',
  'token',
  'resettoken',
  'reset_token',
  'sessioncookie',
  'session_cookie',
  'cookie',
  'jwt',
  'secret',
  'apikey',
  'api_key',
  'authorization',
  'stripe_secret',
  'stripesecretkey',
  'cron_secret',
  'cronsecret',
  'blob_read_write_token',
  'anthropic_api_key',
  'payload',
  'body',
  'requestbody',
  'email',
]

function isDenylisted(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[_-]/g, '')
  return DENYLIST.some((denied) => normalized.includes(denied.replace(/[_-]/g, '')))
}

/** Entfernt (statt zu maskieren – bewusst kein Teilwert, der noch etwas verraten könnte) jedes
 * Feld, dessen Name auf potenziell sensible Inhalte hindeutet. */
export function redact(fields: LogFields): LogFields {
  const result: LogFields = {}
  for (const [key, value] of Object.entries(fields)) {
    result[key] = isDenylisted(key) ? '[redacted]' : value
  }
  return result
}

function toErrorContext(fields: LogFields): ErrorContext {
  return {
    requestId: fields.requestId,
    route: fields.route,
    method: fields.method,
    userId: fields.userId,
    role: fields.role,
    jobId: fields.jobId,
    offerId: fields.offerId,
    notificationId: fields.notificationId,
    stripeEventId: fields.stripeEventId,
    operation: fields.operation,
  }
}

/**
 * Schreibt ein strukturiertes Log-Event als einzelne JSON-Zeile und meldet `level: 'error'`
 * zusätzlich an Sentry. Wirft NIEMALS.
 */
export function logEvent(event: string, level: LogLevel, fields: LogFields = {}, err?: unknown): void {
  try {
    const safeFields = redact(fields)
    const entry = { event, level, ...safeFields, timestamp: new Date().toISOString() }

    if (level === 'error') {
      console.error(JSON.stringify(entry))
    } else if (level === 'warn') {
      console.warn(JSON.stringify(entry))
    } else {
      console.log(JSON.stringify(entry))
    }

    if (level === 'error') {
      const context = toErrorContext(safeFields)
      if (err !== undefined) {
        captureError(err, context)
      } else {
        captureMessage(event, context)
      }
    }
  } catch {
    // Logging selbst darf niemals den aufrufenden Vorgang stören (best-effort, wie Analytics/E-Mail).
  }
}
