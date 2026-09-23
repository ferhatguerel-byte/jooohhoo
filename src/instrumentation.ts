import type { Instrumentation } from 'next'

/**
 * Phase 4.4 (Teil B/D) – Next.js' eingebauter Instrumentierungs-Hook (siehe
 * node_modules/next/dist/docs/.../instrumentation.md). `onRequestError` wird von Next.js selbst
 * für Fehler aufgerufen, die aus dem Rendering (Server Components, Layouts) entkommen und NICHT
 * bereits über `handleApiError` in einem Route Handler gefangen wurden – ein zusätzliches
 * Sicherheitsnetz, kein Ersatz für die zentrale API-Fehlerbehandlung.
 *
 * `register()` bleibt bewusst leer: kein `@vercel/otel`/Tracing-Setup in dieser Phase (out of
 * scope, siehe docs/phase-4.4-observability.md), nur der Error-Hook unten.
 */
export async function onRequestError(
  err: unknown,
  request: Parameters<Instrumentation.onRequestError>[1],
  context: Parameters<Instrumentation.onRequestError>[2]
) {
  const { captureError } = await import('@/lib/observability/sentry')
  const { logEvent } = await import('@/lib/observability/logger')

  const digest =
    typeof err === 'object' && err !== null && 'digest' in err ? String((err as { digest: unknown }).digest) : undefined

  logEvent(
    'unhandled_request_error',
    'error',
    {
      route: request.path,
      method: request.method,
      operation: context.routerKind,
      errorCode: digest,
    },
    err
  )
  captureError(err, { route: request.path, method: request.method, extra: { digest: digest ?? null } })
}
