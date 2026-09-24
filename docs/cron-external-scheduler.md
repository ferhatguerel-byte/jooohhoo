# Match-E-Mail-Retry: externer HTTP-Cron statt Vercel Cron

**Hintergrund:** Vercel Hobby erlaubt pro Cron-Eintrag maximal einen Aufruf pro Tag. Der
Retry-Endpoint war ursprünglich mit `*/5 * * * *` (alle 5 Minuten) in `vercel.json` als
Vercel-Cron konfiguriert – das blockierte auf Hobby jedes Production-Deployment. Der
Vercel-Cron-Eintrag wurde deshalb aus `vercel.json` entfernt. Der Endpoint, seine
Authentifizierung und seine gesamte Retry-/Lease-/Backoff-Logik sind davon **nicht**
betroffen – sie sind unverändert vollständig vorhanden und müssen jetzt nur von einer
anderen Stelle aus periodisch aufgerufen werden.

## Was aufgerufen werden muss

```
GET https://<PRODUCTION_DOMAIN>/api/internal/match-email-retry
Authorization: Bearer <CRON_SECRET>
```

- **Methode:** `GET` (identisch zum bisherigen Vercel-Cron-Verhalten – Vercel Cron ruft
  ebenfalls ausschließlich per `GET` auf, siehe `src/app/api/internal/match-email-retry/route.ts`).
- **Header:** `Authorization: Bearer <CRON_SECRET>` – derselbe `CRON_SECRET`-Wert, der bisher
  in den Vercel-Projekteinstellungen hinterlegt war/ist. Ohne exakt diesen Header antwortet
  der Endpoint mit `401` (fail-closed, unverändert).
- **Empfohlene Frequenz:** alle 5 Minuten (`*/5 * * * *`), passend zum bestehenden
  Lease-Timeout (5 Min.) und den Backoff-Stufen (60s/300s) in
  `src/lib/matching/email-retry-config.ts`. Ein selteneres Intervall funktioniert technisch
  ebenso (der Endpoint ist idempotent und macht bei nichts zu tun nichts), verzögert aber die
  Korrektur fehlgeschlagener Zustellungen entsprechend.
- **Erwartete Antwort bei Erfolg:** `200 {"ok": true, "candidateCount": <n>}`.
- Der Endpoint hat zusätzlich ein eigenes Lauf-Rate-Limit (max. 20 authentifizierte Aufrufe
  pro 60 Minuten, siehe Route) – ein Scheduler im 5-Minuten-Takt (12 Aufrufe/Stunde) liegt
  komfortabel darunter.

## Beispiel-Einrichtung mit einem kostenlosen externen Scheduler

Beliebiger HTTP-Cron-Dienst funktioniert (z. B. cron-job.org, GitHub Actions Scheduled
Workflow, Upstash QStash u. a.) – wichtig ist nur, dass er periodisch exakt diesen GET-Request
mit dem korrekten `Authorization`-Header absetzen kann. Beispielhaft mit einem einfachen
GitHub Actions Workflow (`.github/workflows/match-email-retry-cron.yml`, hier nur als
Referenz-Snippet, nicht Teil dieser Änderung):

```yaml
name: match-email-retry-cron
on:
  schedule:
    - cron: '*/5 * * * *'
jobs:
  trigger:
    runs-on: ubuntu-latest
    steps:
      - name: Call retry endpoint
        run: |
          curl -sS -f -X GET "https://<PRODUCTION_DOMAIN>/api/internal/match-email-retry" \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

`CRON_SECRET` würde dabei als GitHub-Actions-Secret hinterlegt, niemals im Klartext im
Repository. Dasselbe Prinzip gilt für jeden anderen externen Scheduler: das Secret gehört in
dessen sicheren Secret-Speicher, nicht in Code oder Konfigurationsdateien.

## Was sich NICHT ändert

- Die synchrone Match-Notification-E-Mail-Zustellung beim Matching-Lauf
  (`src/lib/matching/run-matching.ts`) läuft weiterhin unverändert sofort, unabhängig vom
  Retry-Cron.
- `CRON_SECRET`-Prüfung, Rate-Limits, Lease-Timeout, Backoff-Stufen, maximale
  Versandversuche und das Batch-Limit pro Lauf (`src/lib/matching/email-retry-config.ts`,
  `src/app/api/internal/match-email-retry/route.ts`) sind unverändert.
- Stripe, Matching-Logik und Datenbankschema sind von dieser Änderung nicht berührt.
