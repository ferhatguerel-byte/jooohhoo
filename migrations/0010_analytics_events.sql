-- Migration 0010: Phase 3.6G – First-Party Matching-Funnel-Analytics (PostgreSQL-basiert, kein
-- externer Anbieter).
--
-- Speichert fachliche Funnel-Ereignisse (Auftrag erstellt -> Match berechnet -> Notification
-- erzeugt -> E-Mail versendet -> gelesen -> Auftrag angesehen -> Angebot abgegeben -> vergeben)
-- als einfache Ereignis-Log-Tabelle. Bewusst EIN generisches event_type TEXT-Feld statt eines
-- ENUM (wie schon bei job_matches.exclusion_reason, siehe Migration 0007) – die Menge der
-- Event-Typen ist eine Anwendungs-/Produktentscheidung (siehe ANALYTICS_EVENTS in
-- src/lib/analytics.ts), die ohne Migration erweiterbar bleiben soll.
--
-- KEINE personenbezogenen Inhalte: keine E-Mail, kein Name, keine Telefonnummer, keine
-- Nachrichten-/Beschreibungstexte, keine IP/User-Agent. Nur IDs (die für sich genommen keine
-- natürliche Person identifizieren, analog zu job_matches/match_notifications) sowie
-- unkritische strukturierte metadata (z.B. Schwellenwert, boolesche Flags). Siehe
-- src/lib/analytics-events.ts für die einzige Schreibstelle.
--
-- actor_user_id/provider_id/notification_id sind bewusst NULL-fähig UND ON DELETE SET NULL (nicht
-- CASCADE): ein gelöschter User/eine gelöschte Notification soll das historische Funnel-Ereignis
-- nicht mitlöschen (dieselbe Begründung wie match_notifications.job_match_id in Migration 0008).
--
-- idempotency_key ist NULLable + UNIQUE: mehrere Zeilen mit NULL sind in PostgreSQL erlaubt (NULL
-- ist nie gleich NULL) – für Events wie JOB_VIEWED, die absichtlich KEINE künstliche Einmaligkeit
-- erzwingen sollen (Phase 3.6G Teil 5). Für Events mit deterministischem Key (z.B.
-- "project_created:<jobId>") verhindert die UNIQUE-Constraint + ON CONFLICT DO NOTHING (siehe
-- trackEvent()/trackEventsBatch()) doppelte fachliche Events race-condition-frei auf DB-Ebene,
-- nicht nur applikationsseitig.

CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  actor_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  job_id UUID NULL REFERENCES jobs(id) ON DELETE SET NULL,
  provider_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  notification_id UUID NULL REFERENCES match_notifications(id) ON DELETE SET NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key TEXT NULL UNIQUE
);

-- Für spätere Funnel-/Zeitreihen-Auswertungen (Phase 3.6G Teil 15/12): pro Event-Typ zeitlich
-- sortiert, sowie je Entität (Nutzer/Job/Provider/Notification) zeitlich sortiert.
CREATE INDEX IF NOT EXISTS idx_analytics_events_type_occurred ON analytics_events(event_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_actor_occurred ON analytics_events(actor_user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_job_occurred ON analytics_events(job_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_provider_occurred ON analytics_events(provider_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_notification ON analytics_events(notification_id);

INSERT INTO schema_migrations (filename) VALUES ('0010_analytics_events.sql')
ON CONFLICT (filename) DO NOTHING;
