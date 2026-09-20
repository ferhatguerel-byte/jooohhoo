-- Migration 0001: Migrations-Tracking-Tabelle + fehlende Indizes für bekannte Hot-Paths.
-- Sicher mehrfach ausführbar (nur IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS schema_migrations (
  filename TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- jobs(auftraggeber_id): "Meine Aufträge"-Liste eines Auftraggebers (dashboard/auftraege)
CREATE INDEX IF NOT EXISTS idx_jobs_auftraggeber ON jobs(auftraggeber_id);

-- users(role, subscription_status): Admin-Funnel-Dashboard, Branchenbuch-Filter
CREATE INDEX IF NOT EXISTS idx_users_role_subscription_status ON users(role, subscription_status);

-- users(plz): regionale Auswertungen (Regional-Preisvergleich, PLZ-Filter im Auftrags-Feed)
CREATE INDEX IF NOT EXISTS idx_users_plz ON users(plz);

-- offers(subunternehmer_id): "Meine Angebote"-Liste eines Unternehmers (ohne created_at-Präfix)
CREATE INDEX IF NOT EXISTS idx_offers_subunternehmer ON offers(subunternehmer_id);

-- hidden_jobs(job_id): Zählung/JOIN in umgekehrter Richtung zum bestehenden Primary Key
CREATE INDEX IF NOT EXISTS idx_hidden_jobs_job ON hidden_jobs(job_id);

INSERT INTO schema_migrations (filename) VALUES ('0001_migrations_table_and_indexes.sql')
ON CONFLICT (filename) DO NOTHING;
