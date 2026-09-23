import type * as SentryNamespace from '@sentry/nextjs'

/**
 * Phase 4.4 (Teil B) – zentrale, produktionsfähige Error-Tracking-Integration.
 *
 * Kein bestehendes Error-Tracking im Repo gefunden (weder Sentry noch ein vergleichbarer Dienst,
 * kein entsprechendes Package). `@sentry/nextjs` ist der De-facto-Standard für Next.js und wird
 * hier bewusst NICHT über den vollen Setup-Wizard (next.config.ts-Wrapping für Source-Map-Upload,
 * das SENTRY_AUTH_TOKEN/SENTRY_ORG/SENTRY_PROJECT zum Bauzeitpunkt braucht) eingebunden – das wäre
 * eine zusätzliche, in dieser Phase nicht verifizierbare Build-Abhängigkeit. Stattdessen: manuelle,
 * schlanke Initialisierung, die OHNE `SENTRY_DSN` vollständig No-op bleibt.
 *
 * WICHTIG – bewusst per DYNAMISCHEM `import()` statt eines statischen Top-Level-Imports: das
 * `@sentry/nextjs`-Paket registriert beim reinen Modul-Laden bereits Node-Instrumentierung
 * (OpenTelemetry-Auto-Instrumentation, u.a. auf `http`/`fetch`). Ein statischer Import hier hätte
 * dieses Paket in JEDEN Testlauf gezogen (da `@/lib/api-error.ts` aus praktisch jeder Route
 * importiert wird) und nachweislich zu nichtdeterministischen Testfehlern in der bestehenden,
 * vollständig gemockten Vitest-Suite geführt (Cross-Test-Interferenz durch die globale
 * Instrumentierung). Der dynamische Import lädt das Paket ausschließlich dann, wenn tatsächlich
 * ein `SENTRY_DSN` gesetzt ist – in Dev/Test/CI ohne DSN wird es nie geladen, kein Seiteneffekt.
 *
 * WICHTIG (ehrlich dokumentiert, siehe auch docs/phase-4.4-observability.md): in dieser Sandbox
 * ist kein SENTRY_DSN verfügbar. Die tatsächliche Zustellung von Events an Sentry konnte daher
 * NICHT gegen ein echtes Projekt verifiziert werden – nur die No-op-/Lazy-Load-Logik selbst
 * (siehe tests/observability/sentry.test.ts). Es wird hier keine erfundene erfolgreiche
 * Verbindung behauptet.
 */
let sentryModulePromise: Promise<typeof SentryNamespace> | null = null
let initialized = false

function loadSentry(): Promise<typeof SentryNamespace> | null {
  // Serverseitig: SENTRY_DSN (nicht öffentlich exponiert). Clientseitig (aus 'use client'-
  // Komponenten wie error.tsx aufgerufen) ersetzt Next.js nur NEXT_PUBLIC_*-Variablen zur
  // Build-Zeit im Browser-Bundle – SENTRY_DSN wäre dort immer `undefined`. Deshalb beide prüfen;
  // in der Praxis derselbe DSN-Wert unter zwei Variablennamen (siehe .env.example).
  const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN
  if (!dsn) return null

  if (!sentryModulePromise) {
    sentryModulePromise = import('@sentry/nextjs').then((Sentry) => {
      if (!initialized) {
        Sentry.init({
          dsn,
          environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
          // Niedrige Sample-Rate für Traces: dieses Projekt braucht in erster Linie
          // Error-Tracking, keine vollständige Performance-Nachverfolgung (Kostenkontrolle).
          tracesSampleRate: 0.1,
          // Serverseitig sind Anfrage-Bodys nie Teil der automatischen Sentry-Instrumentierung
          // gewünscht (Teil E: keine kompletten Request-Bodys/Secrets in Logs/Tracking).
          sendDefaultPii: false,
        })
        initialized = true
      }
      return Sentry
    })
  }
  return sentryModulePromise
}

export interface ErrorContext {
  requestId?: string
  route?: string
  method?: string
  userId?: string
  role?: string
  jobId?: string
  offerId?: string
  notificationId?: string
  stripeEventId?: string
  operation?: string
  /** Zusätzliche, bereits unkritische (keine PII/Secrets) strukturierte Felder. */
  extra?: Record<string, string | number | boolean | null | undefined>
}

/**
 * Meldet einen unerwarteten Fehler an Sentry (No-op ohne SENTRY_DSN, lädt das Paket dann gar
 * nicht erst). Fire-and-forget (kein `await` an den Aufrufstellen nötig) und wirft NIEMALS – ein
 * Fehler beim Reporting selbst darf niemals den eigentlichen Fehlerpfad stören (dasselbe
 * best-effort-Prinzip wie Analytics/E-Mail an anderer Stelle im Repo).
 */
export function captureError(err: unknown, context: ErrorContext = {}): void {
  const modulePromise = loadSentry()
  if (!modulePromise) return
  modulePromise
    .then((Sentry) => {
      Sentry.withScope((scope) => {
        applyContext(scope, context)
        Sentry.captureException(err)
      })
    })
    .catch(() => {
      // best-effort – siehe Kommentar oben.
    })
}

/** Für Fälle ohne Exception-Objekt (z.B. ein fachlich unerwarteter Zustand). */
export function captureMessage(message: string, context: ErrorContext = {}): void {
  const modulePromise = loadSentry()
  if (!modulePromise) return
  modulePromise
    .then((Sentry) => {
      Sentry.withScope((scope) => {
        applyContext(scope, context)
        Sentry.captureMessage(message, 'error')
      })
    })
    .catch(() => {
      // best-effort
    })
}

function applyContext(scope: SentryNamespace.Scope, context: ErrorContext): void {
  if (context.requestId) scope.setTag('request_id', context.requestId)
  if (context.route) scope.setTag('route', context.route)
  if (context.method) scope.setTag('method', context.method)
  if (context.role) scope.setTag('role', context.role)
  if (context.operation) scope.setTag('operation', context.operation)
  if (context.stripeEventId) scope.setTag('stripe_event_id', context.stripeEventId)
  // userId/jobId/offerId/notificationId sind interne IDs, keine natürliche Person für sich
  // genommen identifizierend (analog zur bestehenden Analytics-Konvention, siehe
  // src/lib/analytics-events.ts) – als Kontext, nicht als Sentry-"user" (kein E-Mail/Name).
  scope.setContext('entities', {
    userId: context.userId ?? null,
    jobId: context.jobId ?? null,
    offerId: context.offerId ?? null,
    notificationId: context.notificationId ?? null,
  })
  if (context.extra) scope.setContext('extra', context.extra)
}

/** Nur für Tests: erlaubt einen sauberen Zustand zwischen Testfällen. */
export function resetForTests(): void {
  initialized = false
  sentryModulePromise = null
}
