# Phase 4.3 – API / Abuse Hardening

Härtung der API gegen Spam/Abuse durch zentrale Rate-Limit- und Payload-Hardening-Infrastruktur.
Kein Konzeptwechsel bei Stripe/Matching/Notifications/Analytics/Legal/File-Authorization.

## 1. Bestandsaufnahme (Teil A)

Repo-weite Route-Inventur (`src/app/api/**/route.ts`, 35 Dateien). Auszug der abuse-relevanten
Endpunkte:

| Route | Auth | Rolle | Zweck | Abuse-Risiko | Rate Limit vorher |
|---|---|---|---|---|---|
| `POST /api/jobs` | ✓ | Auftraggeber | Auftrag erstellen | Job-Spam, löst Matching+E-Mails aus | ❌ |
| `PATCH /api/jobs/[id]` | ✓ | Auftraggeber | Auftrag bearbeiten | unbegrenzte Wiederholungen | ❌ |
| `POST /api/jobs/[id]/offers` | ✓ | Subunternehmer | Angebot abgeben/ändern | Angebots-Spam; Quote greift nur beim Erstkontakt | ❌ |
| `POST /api/offers/[id]/messages` | ✓ | Beteiligte | Chat-Nachricht | Chat-/E-Mail-Spam (jede Nachricht → E-Mail) | ❌ |
| `POST /api/support/tickets` | ✓ | jeder | Support-Ticket erstellen | Ticket-Spam, E-Mail an Admin | ❌ |
| `POST /api/support/tickets/[id]/messages` | ✓ | Beteiligte/Admin | Ticket-Antwort | E-Mail-Spam | ❌ |
| `POST /api/auth/forgot-password` | ✗ | – | Reset-Link anfordern | Enumeration/Spam | ✓ (bereits seit Phase 1, 5/60min pro IP+E-Mail) |
| `POST /api/auth/reset-password` | ✗ | – | Token einlösen | automatisiertes Durchprobieren | ❌ |
| `GET /api/internal/match-email-retry` | Secret | – | Cron-Batch | Secret-Brute-Force, Batch-Flooding | nur Signatur-Vergleich, keine Frequenzgrenze |
| `POST /api/upload` | ✓ | jeder | Datei-Upload | – | ✓ (bereits, Phase 1) |
| `POST /api/jobs/generate-lv` | ✓ | Auftraggeber | KI-Leistungsverzeichnis | teure KI-Aufrufe | ✓ (bereits, Phase 1) |
| `POST /api/auth/register` | ✗ | – | Registrierung | Fake-Accounts | ✓ (bereits, Phase 1) |
| `POST /api/auth/login` | ✗ | – | Login | Brute-Force | ✓ (bereits, Phase 1) |

`forgot-password`/`upload`/`generate-lv`/`register`/`login` hatten bereits ein Rate Limit aus
früheren Phasen – nicht erneut implementiert, nur wiederverwendet als Vorbild.

## 2. Zentrale Rate-Limit-Infrastruktur (Teil B)

`src/lib/security/rate-limit.ts` – dünne, ergonomische Fassade über die bereits bestehende,
DB-gestützte Implementierung `src/lib/rate-limit.ts` (Tabelle `rate_limit_hits`, seit Phase 1 im
Einsatz). **Keine zweite Counter-Logik.**

```ts
await rateLimit({ key: 'jobs-create:<userId>', limit: 10, windowSeconds: 3600 })
```

`key`-Konvention: `"<bucket>:<identifier>"` – der Teil vor dem ersten `:` wird als `bucket`
durchgereicht. `windowSeconds` wird auf volle Minuten aufgerundet (DB-Granularität). Wirft die
bestehende `RateLimitError`, die `handleApiError` bereits als HTTP 429 behandelt.

## 3. Rate Limits für kritische Endpunkte (Teil 2)

| Route | Limit | Begründung |
|---|---|---|
| `POST /api/jobs` | 10/h pro Nutzer + 20/h pro IP | Job-Spam (Audit-Fund) |
| `PATCH /api/jobs/[id]` | 20/h pro Nutzer | wiederholtes Bearbeiten |
| `POST /api/jobs/[id]/offers` | 30/h pro Nutzer | Angebots-Spam (Audit-Fund); die bestehende monatliche Leads-Quote greift nur beim Erstkontakt, ein unveröffentlichtes Angebot kann per `ON CONFLICT DO UPDATE` sonst beliebig oft überschrieben werden |
| `POST /api/offers/[id]/messages` | 20/5min pro Nutzer | Chat-Spam (Audit-Fund), engeres Fenster wegen E-Mail-Trigger |
| `POST /api/support/tickets` | 5/h pro Nutzer | Ticket-Spam |
| `POST /api/support/tickets/[id]/messages` | 20/h (Nutzer) bzw. 60/h (Admin) | E-Mail-Trigger, Admin braucht mehr Spielraum |
| `POST /api/auth/reset-password` | 10/h pro IP | Token-Brute-Force-Bremse |
| `GET /api/internal/match-email-retry` | 20/10min pro IP (nur Fehlversuche) + 20/h global (auch bei korrektem Secret) | Secret-Brute-Force + Batch-Flooding-Schutz |

Reihenfolge in jeder Route: **erst Zod-Validierung, dann Rate Limit** (wie bereits im
Registrierungs-Flow etabliert) – eine ungültige Anfrage kostet kein Rate-Limit-Kontingent und
keinen zusätzlichen DB-Zugriff.

## 4. Request-/Payload-Limits (Teil C)

`src/lib/security/request-limits.ts` – `readJsonBody(req, maxBytes = 100_000)` ersetzt
`req.json()` an allen Freitext-Endpunkten (Jobs, Angebote, Nachrichten, Support-Tickets, Profil,
Registrierung). Next.js Route Handler haben keine eingebaute Body-Size-Grenze wie Server Actions –
ohne diese Prüfung könnte ein beliebig großes JSON-Payload vollständig eingelesen/geparst werden,
bevor Zod überhaupt greift. Prüft zuerst `Content-Length` (schneller Ausschluss ohne Body-Lesung),
danach zusätzlich die tatsächliche Byte-Länge. Wirft `PayloadTooLargeError` → 413 über
`handleApiError`.

## 5. Free-Text-Limits (Teil D)

| Feld | Route(n) | vorher | jetzt |
|---|---|---|---|
| `title` | `POST/PATCH /api/jobs` | nur `min(5)` | `min(5).max(200)` |
| `description` | `POST/PATCH /api/jobs` | nur `min(20)` | `min(20).max(5000)` |
| `plz` | `/api/jobs`, `/api/auth/register`, `/api/profile` | nur `min(4)` | `min(4).max(10)` |
| `ort` | `/api/jobs`, `/api/auth/register`, `/api/profile` | nur `min(2)` | `min(2).max(100)` |
| `phone` | `/api/auth/register`, `/api/profile` | unbegrenzt | `max(30)` |

Andere Freitextfelder (Angebots-/Chat-/Support-Nachrichten, `companyName`) hatten bereits
sinnvolle Obergrenzen aus früheren Phasen. Admin-only-Editoren (z.B. `guide-articles.content`)
wurden **nicht** angefasst – kein externer Abuse-Vektor, außerhalb des Scopes dieser Phase.

## 6. Passwort-Reset-Rate-Limit (Teil 5)

`forgot-password` hatte bereits ein Rate Limit (Phase 1). Neu: das Token-**Einlösen** selbst
(`/api/auth/reset-password`) war ungeschützt – jetzt 10/h pro IP als Defense-in-Depth gegen
automatisiertes Durchprobieren, unabhängig von der Token-Entropie selbst.

## 7. Support-Ticket-Rate-Limit (Teil 6)

Siehe Abschnitt 3 – Ticket-Erstellung und -Antworten sind jetzt begrenzt, mit höherem Limit für
Admin-Antworten (legitim hohes Support-Aufkommen).

## 8. Internes Cron-Endpoint-Hardening (Teil 7)

`GET /api/internal/match-email-retry`: die bestehende zeitkonstante Secret-Prüfung
(`timingSafeEqual`) bleibt unverändert. Neu:
- Fehlgeschlagene Authentifizierungsversuche werden pro IP gezählt und gebremst (20/10min) –
  bremst automatisiertes Durchprobieren des `CRON_SECRET`, ohne einen korrekt authentifizierten
  Cron-Aufruf je zu beeinträchtigen.
- Ein globales Kontingent (20/h) gilt auch bei korrektem Secret – schützt gegen eine
  fehlkonfigurierte/doppelt registrierte Cron-Quelle, die den E-Mail-Versand-Batch-Job
  unbeabsichtigt im Kurztakt auslöst. `vercel.json` plant `*/5 * * * *` (12 reguläre Aufrufe/h) –
  20/h lässt Spielraum für Debug-Aufrufe/Jitter, blockt aber echtes Hämmern.

## 9. Abuse-/Spam-Tests (Teil 8)

47 neue Tests unter `tests/security/`:
- `rate-limit.test.ts` (7) – zentrale Fassade: Bucket/Identifier-Zerlegung, Minuten-Rundung, Fehlerweitergabe.
- `request-limits.test.ts` (5) – Payload-Size-Guard (Content-Length-Fastpath + tatsächliche Größe).
- `jobs-rate-limits.test.ts` (11) – Job-Erstellung/-Update: Rate Limit (Nutzer+IP), Free-Text-Limits, 413.
- `offers-messages-rate-limits.test.ts` (4) – Angebots- und Chat-Rate-Limits.
- `support-rate-limits.test.ts` (4) – Ticket-Erstellung/-Antwort-Rate-Limits inkl. Admin-Sonderfall.
- `reset-password-rate-limit.test.ts` (3) – IP-basiertes Limit, unabhängige IPs.
- `cron-hardening.test.ts` (6) – Auth-Fail-Bremse, globales Budget, Fail-Closed, konstante Fehlerantwort.
- `free-text-limits.test.ts` (7) – Registrierung/Profil: phone/plz/ort-Obergrenzen.

Bestehende Tests, die durch die neuen Rate-Limit-/Payload-Aufrufe zusätzliche DB-Queries auslösen
(`jobs-matching-trigger.test.ts`, `offer-messages.test.ts`, `profile-matching-fields.test.ts`,
`auth-flows.test.ts`), wurden mit passenden Mock-Sequenzen aktualisiert – keine
Verhaltensänderung, nur die Testinfrastruktur an die neue (zusätzliche, vorgelagerte)
DB-Interaktion angepasst.

## Nicht angefasst (bewusst außerhalb des Scopes)

- `/api/account/email`, `/api/account/password` (Kontoänderungen) – nicht im Phase-4.0-Audit
  benannt, kein bekannter Abuse-Vektor über reinen Spam hinaus. Mögliche künftige
  Härtungskandidaten, aber keine Aufnahme in dieser Phase ohne expliziten Auftrag.
- `guide-articles`-Admin-Editor – admin-only, kein externer Abuse-Vektor.
- Stripe, Sentry/Observability, SEO, Matching, Notifications, Analytics, Legal, File
  Authorization – jeweils eigene, bereits abgeschlossene oder separate Phasen.
