-- Migration 0009: Phase 3.6F – E-Mail-Zustandsmaschine härten (Retry, Lease, Backoff).
--
-- Neuer Enum-Wert 'sending': markiert eine Notification als aktuell von einem Versandprozess
-- beansprucht (atomarer Claim). Ohne diesen Zwischenzustand ist 'failed' nicht von "gerade in
-- Bearbeitung" unterscheidbar – ein Retry könnte sonst eine noch laufende Zustellung parallel
-- erneut versuchen (das in Phase 3.6D dokumentierte Risiko). Syntax wie im bestehenden Schema
-- bereits etabliert (siehe src/lib/schema.sql, subscription_tier ADD VALUE IF NOT EXISTS).
ALTER TYPE match_notification_status ADD VALUE IF NOT EXISTS 'sending';

-- processing_started_at: Zeitpunkt des letzten Claims. Dient zwei Zwecken, beide ohne eine
-- zusätzliche next_attempt_at-Spalte:
-- 1. Lease-Timeout für 'sending' – eine seit MATCH_EMAIL_LEASE_SECONDS hängende 'sending'-Zeile
--    (Crash zwischen Claim und finalem Status-Update) gilt als abgebrochen und wird wieder
--    claimbar (siehe src/lib/matching/send-match-notification-emails.ts).
-- 2. Backoff-Basis für 'failed' – die Wartezeit vor dem nächsten Versuch wird aus
--    processing_started_at + einem nach attempts gestuften Intervall berechnet
--    (MATCH_EMAIL_BACKOFF_SECONDS), statt eine eigene next_attempt_at-Spalte zu pflegen.
ALTER TABLE match_notifications ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ NULL;

INSERT INTO schema_migrations (filename) VALUES ('0009_match_notification_retry.sql')
ON CONFLICT (filename) DO NOTHING;
