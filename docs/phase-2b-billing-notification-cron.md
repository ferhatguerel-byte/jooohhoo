# Billing-Notification-Retry: externer HTTP-Cron (Phase 2B)

**Hintergrund:** Analog zum bestehenden `/api/internal/match-email-retry` (siehe
`docs/cron-external-scheduler.md`) läuft auch der neue Retry-Batch für Abo-/
Kündigungsbestätigungs-E-Mails (`billing_notification_outbox`, Migration 0014) **nicht**
über Vercel Cron (Hobby-Plan-Limitierung: max. 1 Aufruf/Tag pro Cron-Eintrag), sondern
muss von einem externen Scheduler periodisch aufgerufen werden. Es ist bewusst ein
**eigener** Endpoint, kein gemeinsam genutzter mit dem Match-E-Mail-Retry – beide laufen
unabhängig voneinander und beeinflussen sich nicht.

## Was aufgerufen werden muss

```
GET https://<PRODUCTION_DOMAIN>/api/internal/billing-notification-retry
Authorization: Bearer <CRON_SECRET>
```

- **Methode:** `GET`.
- **Header:** `Authorization: Bearer <CRON_SECRET>` — **derselbe** `CRON_SECRET`-Wert, der
  bereits für `/api/internal/match-email-retry` in den Vercel-Projekteinstellungen
  hinterlegt ist (keine zweite Umgebungsvariable nötig, siehe
  `src/app/api/internal/billing-notification-retry/route.ts`).
- **Empfohlene Frequenz:** alle 5 Minuten (`*/5 * * * *`), passend zum Lease-Timeout
  (5 Min.) und den Backoff-Stufen (60s/300s) in
  `src/lib/billing/billing-notification-config.ts`.
- **Erwartete Antwort bei Erfolg:** `200 {"ok": true, "candidateCount": <n>}`.
- Eigenes Rate-Limit (max. 20 authentifizierte Aufrufe/60 Min.), unabhängig vom Budget des
  Match-E-Mail-Retry-Endpunkts.

## Lokal verifiziert (Phase 2B, Abschlussprüfung)

Gegen eine lokale Postgres-16-Instanz end-to-end getestet: `401` ohne Header, `401` mit
falschem Secret, `200` mit korrektem Secret; ein eingefügter Outbox-Testeintrag wurde vom
Endpoint korrekt geclaimt, der Versandpfad (`sendSubscriptionConfirmationEmail`) ausgelöst
und die Zeile anschließend auf `status='sent'` gesetzt. Nicht gegen Production getestet.

## Einrichtung

Identisches Vorgehen wie beim bestehenden Match-E-Mail-Retry (cron-job.org,
GitHub-Actions-Workflow o. ä.) — siehe `docs/cron-external-scheduler.md` für ein
ausführliches Beispiel. Nur die Ziel-URL ändert sich:

```
https://<PRODUCTION_DOMAIN>/api/internal/billing-notification-retry
```

## Was sich NICHT ändert

- `/api/internal/match-email-retry` und seine Konfiguration bleiben vollständig
  unverändert (siehe `docs/cron-external-scheduler.md`).
- Die synchrone Aktivierung des Abos selbst (`src/app/api/billing/webhook/route.ts`) läuft
  weiterhin sofort beim Stripe-Webhook, unabhängig von diesem Retry-Cron — dieser Cron
  liefert nur die Bestätigungs-E-Mail nach, falls der erste Versandversuch fehlschlägt.
