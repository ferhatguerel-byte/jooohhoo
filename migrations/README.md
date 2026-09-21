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
