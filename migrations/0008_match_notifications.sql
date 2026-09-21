-- Migration 0008: Phase 3.6B – Notification Storage / Idempotenz.
--
-- Speichert PRO Job×Provider-Kombination genau EINE Notification (UNIQUE(job_id, provider_id) –
-- DB-seitig erzwungen, nicht nur applikationsseitig geprüft). Verhindert, dass ein erneuter
-- runMatchingForJob()-Lauf (Phase 3.5, kann beliebig oft wiederholt werden) je zu einer zweiten
-- Notification für dieselbe Kombination führt.
--
-- job_match_id verweist auf den konkreten job_matches-Datensatz, der die Notification ausgelöst
-- hat/auslösen würde. ON DELETE SET NULL statt CASCADE: wird der zugehörige job_matches-Snapshot
-- bei einer Neuberechnung entfernt (z.B. weil der Provider nicht mehr Kandidat ist, siehe Phase
-- 3.5 Snapshot-Strategie), soll die Notification-Historie NICHT mitgelöscht werden – "wir haben
-- diesen Provider für diesen Job benachrichtigt" bleibt als Fakt bestehen, auch wenn der
-- ursprüngliche Match-Snapshot inzwischen veraltet und entfernt wurde.
--
-- match_score ist ein bewusster PUNKT-IN-ZEIT-Snapshot des Scores zum Erstellungszeitpunkt der
-- Notification (NICHT redundant mit matched_factors/missing_data aus job_matches – diese bleiben
-- ausschließlich dort). Der Wert in job_matches kann sich durch spätere Neuberechnung ändern,
-- match_notifications.match_score dokumentiert dagegen, welcher Score tatsächlich zur
-- (späteren) Benachrichtigung geführt hat.
--
-- status: 'pending' (Default, erzeugt aber noch nicht versendet), 'sent' (E-Mail erfolgreich
-- versendet, kommt erst mit Phase 3.6D), 'failed' (Versand fehlgeschlagen). Bewusst KEIN eigener
-- 'read'-Status: ob gelesen wurde, ergibt sich eindeutig aus read_at IS NOT NULL – ein separater
-- Statuswert dafür wäre eine redundante, potenziell widersprüchliche zweite Quelle der Wahrheit.
--
-- Phase 3.6B legt nur die Speicher-/Idempotenz-Grundlage: es gibt noch KEINEN Code, der hier
-- automatisch Zeilen einfügt (kommt erst mit dem Threshold in Phase 3.6C) und keinen E-Mail-
-- Versand (Phase 3.6D).

DO $$ BEGIN
  CREATE TYPE match_notification_status AS ENUM ('pending', 'sent', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS match_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_match_id UUID NULL REFERENCES job_matches(id) ON DELETE SET NULL,
  match_score SMALLINT NULL,
  status match_notification_status NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ NULL,
  read_at TIMESTAMPTZ NULL,
  CONSTRAINT match_notifications_score_range CHECK (match_score IS NULL OR (match_score >= 0 AND match_score <= 100)),
  UNIQUE (job_id, provider_id)
);

-- Für die spätere "Für Sie passende Projekte"-Ansicht (Phase 3.6E): eigene Notifications eines
-- Providers, neueste zuerst.
CREATE INDEX IF NOT EXISTS idx_match_notifications_provider ON match_notifications(provider_id, created_at DESC);

-- Für einen späteren Versand-Prozess (Phase 3.6D): offene ('pending') Notifications finden, ohne
-- die gesamte Tabelle zu scannen.
CREATE INDEX IF NOT EXISTS idx_match_notifications_status ON match_notifications(status, created_at);

INSERT INTO schema_migrations (filename) VALUES ('0008_match_notifications.sql')
ON CONFLICT (filename) DO NOTHING;
