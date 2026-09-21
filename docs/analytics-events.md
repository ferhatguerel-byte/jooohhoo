# First-Party Matching-Funnel-Analytics (Phase 3.6G)

Kurzdokumentation der Tabelle `analytics_events` (Migration `0010_analytics_events.sql`) und ihrer
Schreibschicht `src/lib/analytics-events.ts`. Kein externer Analytics-Anbieter – ausschließlich
First-Party-PostgreSQL.

## Event-Namen

| Event (`event_type`) | Bedeutung | Wird erzeugt in |
|---|---|---|
| `project_created` | Auftrag erfolgreich erstellt (nach Commit) | `src/app/api/jobs/route.ts` |
| `match_created` | Match für einen eligiblen Provider persistiert (job_matches) | `src/lib/matching/run-matching.ts` |
| `match_notification_created` | Neue `match_notifications`-Zeile erzeugt (Threshold erreicht) | `src/lib/matching/create-match-notifications.ts` |
| `match_email_sent` | Match-E-Mail von Resend bestätigt erfolgreich versendet | `src/lib/matching/send-match-notification-emails.ts` |
| `match_notification_read` | Notification vom Handwerker erstmals gelesen | `src/app/api/match-notifications/[id]/read/route.ts` |
| `job_viewed` | Auftrag von einem Handwerker tatsächlich geöffnet | `src/app/dashboard/jobs/page.tsx` |
| `offer_received` | Angebot abgegeben (**Funnel-Schritt "OFFER_CREATED"** – bestehender Event-Name wiederverwendet, keine Duplizierung) | `src/app/api/jobs/[id]/offers/route.ts` |
| `offer_accepted` | Auftrag vergeben (**Funnel-Schritt "JOB_AWARDED"** – bestehender Event-Name wiederverwendet, keine Duplizierung) | `src/app/api/jobs/[id]/award/route.ts` |

Alle Event-Namen sind zentral in `ANALYTICS_EVENTS` (`src/lib/analytics.ts`) definiert.

## Enthaltene IDs

Jede Zeile kann `actor_user_id`, `job_id`, `provider_id`, `notification_id` enthalten (alle
NULL-fähig, `ON DELETE SET NULL`). Welche Felder ein Event füllt, ist an der jeweiligen
Aufrufstelle dokumentiert (siehe Kommentare dort).

## Erlaubte Metadata

Nur unkritische, strukturierte Werte (Booleans, Zahlen, Kategorien wie `gewerk`), z.B.
`{"gewerk": "Elektro", "hasBudget": true}` oder `{"threshold": 70}`. NIEMALS: E-Mail, Telefon,
Name, Adresse, Nachrichten-/Beschreibungstext, Dateiinhalte/-namen mit Personenbezug, Session-/
JWT-Inhalte, Stripe-/Resend-Daten, vollständige Fehlermeldungen mit PII, Scores/Exclusion-Reasons/
interne Matching-Details.

## Idempotenz

Optionaler `idempotency_key` (z.B. `project_created:<jobId>`, `match_email_sent:<notificationId>`)
über eine DB-UNIQUE-Constraint + `ON CONFLICT (idempotency_key) DO NOTHING` – race-condition-frei,
real gegen PostgreSQL mit zwei parallelen Prozessen verifiziert. `job_viewed` hat bewusst KEINEN
Key (mehrfache Views sind fachlich korrekt und gewollt).

## Datenschutzprinzip

Datensparsam: keine IP-Adresse, kein User-Agent, keine vollständige URL mit Query-Parametern,
keine Freitexte. Nur IDs/Kategorien/Booleans, die für sich genommen keine natürliche Person
identifizieren.

## Verhalten bei Analytics-DB-Fehlern

Best-effort, wirft nie: `trackEvent()`/`trackEventsBatch()` (`src/lib/analytics-events.ts`) fangen
jeden DB-Fehler intern ab und loggen nur den Event-Typ (keine PII/Secrets). Ein Analytics-Fehler
kann niemals Auftragserstellung, Matching, Notification-Erzeugung, E-Mail-Versand,
Angebotserstellung oder Auftragsvergabe verhindern oder als Fehler an den Client zurückmelden.

## Architektur-Hinweis: zwei getrennte Schreibwege

`track()` (`src/lib/analytics.ts`) bleibt ein synchroner Konsolen-Log-no-op – diese Datei wird
auch von Client-Komponenten importiert (z.B. `TrackedCtaLink.tsx`), ein direkter PostgreSQL-
Schreibzugriff (`pg`) kann im Browser-Bundle nicht laufen. `trackEvent()`/`trackEventsBatch()`
(`src/lib/analytics-events.ts`, NEU) sind die echte First-Party-Persistenz und ausschließlich aus
serverseitigem Code aufrufbar. Details siehe Kommentar in `src/lib/analytics.ts`.

## Kein öffentliches Analytics-API

Es gibt keine Route wie `/api/analytics` für normale Nutzer. Lesezugriff (für spätere
Funnel-Auswertungen) erfolgt ausschließlich über eigene, serverseitige Query-Funktionen bei Bedarf.

---

# Analytics Admin / Funnel Insights (Phase 3.6H)

Internes Dashboard unter `/dashboard/admin/analytics` – ausschließlich für Admins (`requireAdmin()`
aus `src/lib/authorization.ts`, keine eigene Auth-Logik). Zeigt AUSSCHLIESSLICH aggregierte Zahlen
aus `analytics_events`. Query-Schicht: `src/lib/analytics-queries.ts`.

## Verfügbare KPIs

Acht Event-Counts (Häufigkeit des jeweiligen Ereignisses im gewählten Zeitraum):
`projectCreated`, `matchCreated`, `matchNotificationCreated`, `matchEmailSent`,
`matchNotificationRead`, `jobViewed`, `offerReceived`, `offerAccepted`.

## Zeitraumfilter

`resolveAnalyticsDateRange()` löst `range`/`from`/`to`-Query-Parameter IMMER serverseitig zu einem
UTC-basierten, halboffenen Intervall `[from, to)` auf – nie eine vom Client übermittelte "aktuelle
Zeit". Presets: `7d`, `30d` (Default), `90d`, `month` (Beginn des aktuellen UTC-Monats bis jetzt),
`custom` (freier Zeitraum, `from`/`to` als `YYYY-MM-DD`, `to`-Tag inklusiv). Ein fehlender,
unbekannter oder unvollständiger/ungültiger Zeitraum fällt sicher auf `30d` zurück – es wird nie
ein ungültiger Wert an SQL weitergereicht. Zeitbasis ist ausschließlich `occurred_at`.

## Funnel-Definition

Reihenfolge: `PROJECT_CREATED` → `MATCH_CREATED` → `MATCH_NOTIFICATION_CREATED` →
`MATCH_EMAIL_SENT` → `MATCH_NOTIFICATION_READ` → `JOB_VIEWED` → `OFFER_RECEIVED` →
`OFFER_ACCEPTED`. Die im Dashboard gezeigten Funnel-Zahlen sind rohe **Event-Counts** (wie oft ist
das Ereignis im Zeitraum aufgetreten) – **keine** Entity-Conversion. Ein Job mit mehreren Matches
erzeugt mehrere `match_created`-Events, zählt aber (siehe unten) nur einmal als "Job mit
mindestens einem Match".

## Entity-Conversion-Definition

Sechs Verhältnisse, jedes ausschließlich über `COUNT(DISTINCT job_id)` bzw.
`COUNT(DISTINCT notification_id)` hergeleitet (nie durch Division zweier unabhängiger
Event-Counts):

| Rate | Formel |
|---|---|
| `matchPerJob` | Jobs mit ≥1 Match / erstellte Jobs |
| `notificationPerMatchedJob` | Jobs mit ≥1 Notification / Jobs mit ≥1 Match |
| `readPerNotification` | Notifications mit Read / erzeugte Notifications |
| `viewPerNotifiedJob` | Jobs mit Job-View / Jobs mit Notification |
| `offerPerViewedJob` | Jobs mit Angebot / Jobs mit Job-View |
| `awardPerOfferedJob` | Jobs mit Vergabe / Jobs mit Angebot |

Ist der Nenner 0, ist die Rate `null` (nie `NaN`/`Infinity`, keine erfundene Prozentzahl ohne
Datenbasis) – im UI als „–“ dargestellt.

**Event Count ist NICHT automatisch Entity Conversion.** Ein Anstieg von `matchCreated` bedeutet
nicht zwingend mehr betroffene Jobs (könnte auch mehr Matches pro Job sein) – dafür immer die
Entity-Conversion-Tabelle heranziehen, nie die rohen Funnel-Zahlen durcheinander dividieren.

## Bekannte Grenzen

- Keine Score-Kalibrierung: `analytics_events` speichert bewusst keine Match-Scores. Eine
  Auswertung "Conversion nach Score-Band (70–79/80–89/90–100)" würde eine Verknüpfung mit
  `job_matches` erfordern – **nicht Teil dieser Phase**, kann in einer späteren Phase ergänzt
  werden.
- Kein CSV-/Excel-Export in dieser Phase.
- Keine algorithmische Bewertung ("Matching funktioniert gut/schlecht") – das Dashboard zeigt
  ausschließlich Zahlen, keine Interpretation.
- `MATCH_EMAIL_SENT`/`MATCH_NOTIFICATION_READ` als Entity-Conversion-Nenner nutzen bewusst
  `notification_id` statt `job_id` (eine Notification ist die stabilere, 1:1-Einheit für diese
  beiden Schritte).
