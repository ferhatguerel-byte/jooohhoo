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
