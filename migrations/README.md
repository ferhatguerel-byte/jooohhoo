# Datenbank-Migrationen

Ab dieser Phase wächst `src/lib/schema.sql` nicht mehr weiter. Neue Datenbankänderungen
kommen als nummerierte, idempotente `.sql`-Dateien in diesen Ordner.

## Regeln

- Dateiname: `NNNN_kurze_beschreibung.sql`, fortlaufend nummeriert.
- Jede Migration muss idempotent sein (`IF NOT EXISTS` etc.), damit ein versehentlicher
  Doppellauf nicht fehlschlägt.
- Jede Migration trägt sich am Ende selbst in die Tabelle `schema_migrations` ein:
  ```sql
  INSERT INTO schema_migrations (filename) VALUES ('NNNN_kurze_beschreibung.sql')
  ON CONFLICT (filename) DO NOTHING;
  ```
- Keine destruktiven Änderungen (`DROP TABLE`, `DROP COLUMN`, Datentyp-Änderungen mit
  Datenverlust) ohne vorherige ausdrückliche Absicherung/Backup und Rücksprache.
- Bestehende Daten dürfen durch eine Migration nie verloren gehen.

## Ausführen

**Wie bisher (Neon SQL Editor):** Inhalt der jeweiligen `.sql`-Datei kopieren und im
Neon SQL Editor ausführen. Die Datei trägt sich dabei selbst in `schema_migrations` ein.

**Alternativ (lokal/CI):**
```bash
DATABASE_URL="postgres://..." node scripts/migrate.mjs
```
Wendet alle noch nicht angewendeten Migrationen in Reihenfolge an und überspringt bereits
angewendete automatisch.

## Historie

- `0001_migrations_table_and_indexes.sql` – Migrations-Tracking-Tabelle + fehlende Indizes
  (jobs.auftraggeber_id, users(role, subscription_status), users.plz, offers.subunternehmer_id,
  hidden_jobs.job_id).
- `0002_admin_audit_log.sql` – Admin-Audit-Log-Tabelle für sicherheitsrelevante Admin-Aktionen.
- `0003_private_files.sql` – Zuordnungstabelle für private Datei-Uploads (Qualifikationsnachweise,
  Auftrags-Anhänge); Zugriff nur über die serverseitig autorisierte Route `/api/files/[id]`.
- `0004_seo_architecture.sql` – `users.company_slug` (stabiler kanonischer Firmen-Slug für
  `/firma/[slug]`) sowie `seo_landing_pages` (Status/Quality-Score-Tracking für programmatische
  SEO-Landingpages, siehe `src/lib/seo/`).
- `0005_seo_admin_notes.sql` – `seo_landing_pages.admin_note` für die SEO-Admin-Oberfläche
  (`/dashboard/admin/seo`).
- `0006_provider_matching_profile.sql` – `users.service_radius_km`, `users.min_project_size`,
  `users.max_project_size` (Phase 3.2 – optionale Matching-Präferenzen des Unternehmers, noch
  ohne Matching-Logik; siehe `src/app/dashboard/profil/ProfileForm.tsx`).
- `0007_job_matches.sql` – `job_matches` (Phase 3.5 – ein aktueller Match-Snapshot pro
  job_id×provider_id, inkl. Score-Range-Check und Exclusion-Consistency-Check; siehe
  `src/lib/matching/run-matching.ts`).
- `0008_match_notifications.sql` – `match_notifications` (Phase 3.6B – Idempotenz-Grundlage für
  künftige Match-Benachrichtigungen, UNIQUE(job_id, provider_id), `job_match_id` verweist auf
  `job_matches(id)` mit `ON DELETE SET NULL`; noch keine automatische Befüllung, kein E-Mail-
  Versand).
- `0009_match_notification_retry.sql` – Phase 3.6F: neuer Enum-Wert `'sending'` für
  `match_notification_status` sowie `match_notifications.processing_started_at` (Lease-Timeout
  für hängende Zustellungen + Backoff-Basis für Retries; siehe
  `src/lib/matching/send-match-notification-emails.ts`).
- `0010_analytics_events.sql` – Phase 3.6G: `analytics_events` (First-Party-PostgreSQL-Analytics
  für den Matching-Funnel; `event_type` TEXT statt ENUM, `idempotency_key` NULLable + UNIQUE für
  deterministische Einmaligkeit pro Event, `job_id`/`provider_id`/`actor_user_id`/
  `notification_id` alle `ON DELETE SET NULL`; siehe `src/lib/analytics-events.ts`).
- `0011_stripe_webhook_events.sql` – Phase 4.2: `stripe_webhook_events` (DB-garantierte
  Stripe-Webhook-Idempotenz, `stripe_event_id UNIQUE` + `ON CONFLICT DO NOTHING`) sowie
  `users.subscription_state_updated_at` (Ordering-Guard gegen verspätete/ungeordnete
  Stripe-Events; siehe `src/lib/billing/` und `docs/phase-4.2-stripe-hardening.md`).
