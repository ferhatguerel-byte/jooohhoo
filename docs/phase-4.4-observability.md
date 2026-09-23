# Phase 4.4 – Observability / Error Tracking / Production Monitoring

Zentrales Error Tracking, strukturiertes Logging, Request-IDs und eine Health-Prüfung für den
Produktivbetrieb. Kein Konzeptwechsel bei Matching/Stripe/Rate-Limiting/SEO/Legal – siehe die
jeweiligen bestehenden Doku-Dateien dazu.

## 1. Bestandsaufnahme (Teil A)

Kein bestehendes Error-Tracking-System, kein Request-ID-Mechanismus, kein Health-Endpoint im Repo
gefunden. `handleApiError` (`src/lib/api-error.ts`, seit Phase 1) war bereits die zentrale Stelle,
an der jeder unerwartete 500er in den API-Routen landet – die natürliche Anknüpfungsstelle für
Error Tracking, ohne jede der ~40 Routen einzeln anzufassen. `error.tsx`/`global-error.tsx`/
`dashboard/error.tsx`/`not-found.tsx` existierten bereits und zeigten dem Nutzer schon vor dieser
Phase keine Stacktraces/internen Details – nur `console.error` ohne Error-Tracking-Anbindung.

## 2. Error Tracking (Teil B)

`@sentry/nextjs` (De-facto-Standard für Next.js) als einziges neues Error-Tracking-Paket, manuell
und schlank eingebunden über `src/lib/observability/sentry.ts`:

- **Kein Setup-Wizard/Source-Map-Upload** (next.config.ts-Wrapping mit
  `SENTRY_AUTH_TOKEN`/`SENTRY_ORG`/`SENTRY_PROJECT`) – das wäre eine zusätzliche, in dieser
  Sandbox nicht verifizierbare Build-Abhängigkeit. Stattdessen manuelles `Sentry.init()` mit
  `captureError()`/`captureMessage()`.
- **Dynamischer `import()`**, nicht statisch: das reine Laden von `@sentry/nextjs` registriert
  bereits Node-Instrumentierung (OpenTelemetry-Auto-Instrumentation), was in der bestehenden,
  vollständig gemockten Vitest-Suite nachweislich zu nichtdeterministischen Testfehlern führte
  (siehe Abschnitt 13). Das Paket wird daher NUR geladen, wenn tatsächlich `SENTRY_DSN` (oder
  `NEXT_PUBLIC_SENTRY_DSN`) gesetzt ist.
- **Vollständiger No-op ohne DSN**: kein Absturz, kein Netzwerkaufruf, `captureError()`/
  `captureMessage()` wirft niemals (best-effort, wie Analytics/E-Mail an anderer Stelle im Repo).
- **Server + Client**: `SENTRY_DSN` (serverseitig) und `NEXT_PUBLIC_SENTRY_DSN` (clientseitig,
  da Next.js nur `NEXT_PUBLIC_*` ins Browser-Bundle exponiert) – in der Praxis derselbe DSN-Wert.

**Ehrlich dokumentiert:** In dieser Sandbox ist kein `SENTRY_DSN` verfügbar. Die tatsächliche
Zustellung von Events an ein echtes Sentry-Projekt konnte **nicht verifiziert werden** – nur die
No-op-/Lazy-Load-Logik selbst (`tests/observability/sentry.test.ts`). Vor Produktivbetrieb muss
ein echtes Sentry-Projekt angelegt und der DSN in den Vercel-Projekteinstellungen gesetzt werden;
danach empfiehlt sich ein manueller Test (z.B. ein absichtlich erzeugter 500er) gegen das echte
Projekt.

## 3. Error Boundary (Teil C)

`error.tsx`, `global-error.tsx`, `dashboard/error.tsx`, `not-found.tsx` existierten bereits und
zeigen dem Nutzer generische Meldungen ohne Stacktraces/DB-Details/Secrets. Neu: alle drei
Error-Boundary-Komponenten melden den Fehler zusätzlich an `captureError()` (Teil B), inkl. Next.js'
eigenem `digest`-Feld (die bereits anonymisierte Kennung für serverseitig entstandene Fehler).

## 4. API Error Tracking (Teil D)

`handleApiError()` unterscheidet weiterhin klar:

- **Expected** (400 Zod-Validierung, 401/403 Autorisierung, 413 Payload zu groß, 429 Rate-Limit)
  → eigene Nachricht/Status, **kein** Error-Tracking-Aufruf.
- **Unexpected** (alles andere: DB-Verbindungsfehler, Stripe-SDK-Fehler, Bugs) → generische
  500-Antwort mit `errorId`, strukturiertes Server-Log + `captureError()`.

Zusätzlich zur zentralen Stelle in `handleApiError` wurden die explizit benannten kritischen
Pfade gehärtet, die NICHT über `handleApiError` laufen (Webhook/Cron/best-effort-Catches):
Stripe-Webhook, Cron-Batch, Matching-Pipeline (Analytics/Notification/E-Mail-Versand),
Resend (`email.ts`, zentral für ALLE Aufrufstellen), Anthropic (`ai.ts`).

## 5. Request Context (Teil E)

Jeder über `handleApiError(err, msg, req)` gemeldete unerwartete Fehler bekommt (soweit verfügbar):
`requestId`, `route`, `method` als Sentry-Tags plus `errorId`/`fallbackMessage` als Extra-Kontext.
Die kritischen Pfade (Webhook, Cron, Matching) geben zusätzlich `stripeEventId`/`jobId`/
`notificationId`/`operation` mit.

**Nie geloggt/getrackt:** `redact()` (`src/lib/observability/logger.ts`) entfernt defensiv jedes
Feld, dessen Name auf Passwort/Token/Cookie/JWT/Secret/API-Key/CRON_SECRET/
BLOB_READ_WRITE_TOKEN/Payload/Body/E-Mail hindeutet – Verteidigung in der Tiefe zusätzlich zur
Disziplin an den Aufrufstellen (die ohnehin nie ganze Request-Bodys oder Secrets übergeben).
`email.ts` loggt beim Resend-Fehler bewusst nie die Empfänger-Adresse, nur den Fehlercode.

## 6. Request ID (Teil F)

Keine bestehende Request-ID-Infrastruktur gefunden. `src/lib/observability/request-id.ts` +
`src/proxy.ts` (Next.js 16 – `middleware.ts` wurde in Next 16 zu `proxy.ts` umbenannt, siehe
`node_modules/next/dist/docs/.../proxy.md`):

- `src/proxy.ts` existierte bereits (Dashboard-Session-Auth) – um **eine** Proxy-Datei/einen
  Matcher zu behalten (Next.js erlaubt nur eine), wurde die bestehende Logik in
  `handleDashboardAuth()` ausgelagert und um `withRequestId()` für `/api/:path*` ergänzt, ohne das
  bestehende Auth-Verhalten zu verändern (per E2E-Suite verifiziert, siehe Abschnitt 15).
- Ein vom Client mitgelieferter `X-Request-ID`-Header wird **nur übernommen, wenn er eine valide
  UUID ist** (`isValidRequestId()`), sonst serverseitig neu erzeugt – kein blindes Vertrauen.
- Auf dem weitergeleiteten Request UND auf der Response gesetzt (Route Handler lesen sie über
  `getRequestId(req)`, der Client sieht sie im `X-Request-ID`-Response-Header). Live gegen den
  lokalen Server verifiziert (`curl -i`, siehe Abschlussbericht).

## 7. Structured Logging (Teil G)

`src/lib/observability/logger.ts` → `logEvent(event, level, fields, err?)`: EIN JSON-Objekt pro
Zeile (`console.log`/`warn`/`error` je nach `level`), z.B.:

```json
{"event":"stripe_webhook_failed","level":"error","requestId":"...","stripeEventId":"evt_...","eventType":"invoice.payment_failed","timestamp":"..."}
```

`level: 'error'` wird zusätzlich automatisch ans Error-Tracking weitergereicht – ein Aufruf deckt
beides ab. Eingesetzt in: Stripe-Webhook, Cron-Batch (ersetzt das bisherige unstrukturierte
`console.log`), `/api/health` (Fehlerfall), Anthropic-Fehler. Die best-effort-Catches in der
Matching-Pipeline behalten ihr bestehendes `console.error`-Format (von bestehenden Tests exakt
geprüft) und bekommen zusätzlich `captureError()` als separaten Aufruf – keine Änderung an
bereits getesteten Log-Zeilen.

## 8. Datenschutz (Teil E/9)

Siehe Abschnitt 5 (`redact()`-Denylist). `sendDefaultPii: false` in der Sentry-Konfiguration
(keine automatische IP-/User-Agent-Erfassung durch das SDK selbst). Kein vollständiges
Stripe-Event-Payload, kein Request-Body, keine Passwörter/Tokens/Cookies/JWTs/API-Keys jemals in
einem Log- oder Tracking-Aufruf dieser Phase.

## 9. Health-/Readiness-Prüfung (Teil 10)

`GET /api/health` – öffentlich, unauthentifiziert, ein minimaler `SELECT 1`-DB-Roundtrip:

```json
{"status":"ok","db":"ok","latencyMs":19}
```

Bei DB-Fehler: `503 {"status":"error","db":"unreachable"}` – **keine** internen
Verbindungsdetails/Secrets in der Antwort, nur ein strukturiertes Server-Log +
Error-Tracking-Meldung. Live gegen den lokalen Server verifiziert.

## 10. Produktionsdiagnose (Teil 11)

- **Health-Check:** `GET /api/health` für Uptime-Monitore/Load-Balancer.
- **Request-Korrelation:** jede API-Antwort trägt `X-Request-ID` – bei einem Nutzerproblem kann
  diese ID (oder die `errorId` aus einer 500-Antwort) im strukturierten Server-Log bzw. in Sentry
  gesucht werden.
- **Strukturierte Logs:** jede Zeile ist gültiges JSON mit `event`/`level`/Kontextfeldern – per
  `grep`/Log-Aggregator (Vercel Log Drains, Datadog, etc.) maschinell auswertbar.
- **Sentry (mit DSN):** vollständige Stacktraces, Tags (`request_id`, `route`, `method`,
  `stripe_event_id`, ...) pro Event, gruppiert nach Fehlertyp.
- **`instrumentation.ts`:** `onRequestError` als Sicherheitsnetz für Fehler, die aus dem
  Server-Component-Rendering entkommen und nicht bereits über `handleApiError` gefangen wurden.

## Offene Punkte

- Source-Map-Upload für lesbare Stacktraces in Sentry (Build-Zeit-Integration mit
  `SENTRY_AUTH_TOKEN`) ist bewusst nicht Teil dieser Phase – kann später ergänzt werden, sobald
  ein echtes Sentry-Projekt existiert.
- Kein Performance-/Tracing-Setup (`@vercel/otel`) – nur Error-Tracking, wie im Scope gefordert.
- Client-seitiges Error-Tracking (`NEXT_PUBLIC_SENTRY_DSN`) ist vorbereitet, aber ungetestet ohne
  echten DSN (siehe Abschnitt 2).
