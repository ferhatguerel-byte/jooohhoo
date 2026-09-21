-- Migration 0011: Phase 4.2 – Stripe-Webhook-Idempotenz + Event-Ordering-Schutz.
--
-- Vorher gab es KEINE persistierte Stripe-Event-Idempotenz (nur die implizite Annahme, dass
-- Stripe jedes Event "irgendwann genau einmal" zustellt – tatsächlich garantiert Stripe weder
-- Exactly-Once-Zustellung noch Reihenfolge). `stripe_webhook_events` macht Idempotenz zu einer
-- echten DB-Garantie über `stripe_event_id UNIQUE` + `INSERT ... ON CONFLICT DO NOTHING`
-- (dasselbe bewährte Muster wie `analytics_events.idempotency_key`, Migration 0010) statt einer
-- reinen JS-seitigen "already processed"-Prüfung, die bei zwei parallelen Requests eine
-- Race Condition hätte.
--
-- Bewusst KEIN vollständiges Payload-Feld: nur was für Idempotenz/Ordering/Debugging/
-- Reconciliation tatsächlich gebraucht wird (Teil W, Datenschutz). Keine Payment-/Customer-
-- Rohdaten, keine PII.
DO $$ BEGIN
  CREATE TYPE stripe_webhook_event_status AS ENUM ('received', 'processing', 'processed', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  -- Stripe Event Creation Time (event.created, Unix-Sekunden -> TIMESTAMPTZ). Grundlage für die
  -- Event-Ordering-Prüfung (Teil D) – NICHT received_at, da Stripe-Events verspätet/ungeordnet
  -- eintreffen können und die Reihenfolge des Entstehens bei Stripe zählt, nicht die des Empfangs.
  stripe_created_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ NULL,
  status stripe_webhook_event_status NOT NULL DEFAULT 'received',
  error_message TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_status ON stripe_webhook_events(status);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_type_created ON stripe_webhook_events(event_type, stripe_created_at DESC);

-- Ordering-Guard (Teil D): der Zeitpunkt des zuletzt tatsächlich angewendeten
-- Subscription-relevanten Stripe-Events (bzw. einer gleichwertig autoritativen lokalen Aktion,
-- z.B. Admin-Kündigung/Reconciliation) pro Nutzer. Jede schreibende Stelle für
-- subscription_status/subscription_tier/subscription_cancel_at aus einem Stripe-Event MUSS diese
-- Spalte per WHERE-Bedingung ("nur überschreiben, wenn neuer") mit aktualisieren – siehe
-- src/lib/billing/subscription-state.ts. Ein isoliertes "if already processed in JS" reicht hier
-- nicht: zwei nebenläufige Webhook-Requests mit unterschiedlichen Event-IDs, aber
-- unterschiedlichem Alter, müssen sich atomar auf DB-Ebene korrekt ordnen.
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_state_updated_at TIMESTAMPTZ NULL;

INSERT INTO schema_migrations (filename) VALUES ('0011_stripe_webhook_events.sql')
ON CONFLICT (filename) DO NOTHING;
