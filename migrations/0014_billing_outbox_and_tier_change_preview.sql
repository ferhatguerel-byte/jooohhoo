-- Migration 0014: Phase 2B – technische Infrastruktur für Vertrags-/Kündigungsbestätigungen
-- (Outbox-Muster, analog match_notifications/Phase 3.6F) und einen sicheren, vorschaubasierten
-- Tarifwechsel. Reine Technik – KEIN neuer Rechtstext, KEINE Aussage zur Rechtssicherheit. Ob und
-- für welche Fälle eine Widerrufs-/Kündigungsbestätigung rechtlich zwingend ist, bleibt offen
-- (siehe Verbraucherrecht-Audit Phase 1/2A) – diese Tabellen schaffen nur die technische
-- Voraussetzung, unabhängig vom Ausgang dieser Rechtsfrage.

DO $$ BEGIN
  CREATE TYPE billing_notification_kind AS ENUM ('subscription_confirmation', 'cancellation_confirmation');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE billing_notification_status AS ENUM ('pending', 'sending', 'sent', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Outbox für Abo-bezogene Bestätigungs-E-Mails (Aufgabe 1/2, Phase 2B). `dedupe_key` erzwingt
-- DB-seitig höchstens EINE Zeile je auslösendem fachlichem Ereignis (z.B. ein konkretes
-- Stripe-Event oder eine Kündigungserklärung mit festem Beendigungszeitpunkt) – ein Webhook-Retry
-- oder ein Doppelklick legt dadurch nie eine zweite Zeile an (UNIQUE + ON CONFLICT DO NOTHING im
-- aufrufenden Code, analog stripe_webhook_events aus Migration 0011).
--
-- `payload` ist ein zum Zeitpunkt des auslösenden Ereignisses eingefrorener Snapshot der für die
-- E-Mail relevanten Vertragsdaten (Tarif, Preis, Laufzeit, Zeitpunkte). Er wird NIE zum
-- Versandzeitpunkt aus den aktuellen TIERS-Konstanten neu berechnet – diese können sich künftig
-- ändern, der historische Vertragsinhalt würde sonst verfälscht. Für bereits vor dieser Migration
-- bestehende Abos existiert kein solcher Snapshot (keine rückwirkende Befüllung, keine erfundenen
-- historischen Daten – siehe Abschlussbericht Phase 2B).
CREATE TABLE IF NOT EXISTS billing_notification_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind billing_notification_kind NOT NULL,
  dedupe_key TEXT NOT NULL,
  payload JSONB NOT NULL,
  status billing_notification_status NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT NULL,
  processing_started_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ NULL,
  UNIQUE (dedupe_key)
);

CREATE INDEX IF NOT EXISTS idx_billing_notification_outbox_status
  ON billing_notification_outbox(status, created_at);

-- Kurzlebige, serverseitig berechnete Tarifwechsel-Preisvorschau (Aufgabe 3, Phase 2B). Ein Client
-- übermittelt beim eigentlichen Wechsel niemals selbst einen Preis oder Ziel-Tarif zur Ausführung –
-- er erhält von der Preview-Route nur diese `id` zurück und muss sie beim bestätigenden Aufruf
-- vorlegen; der Server liest Tarif/Betrag für die tatsächliche Ausführung ausschließlich aus
-- dieser Zeile (siehe src/app/api/billing/checkout/route.ts). `consumed_at` verhindert per
-- atomarem UPDATE ... WHERE consumed_at IS NULL, dass dieselbe Vorschau zweimal ausgeführt wird
-- (Doppelklick-/Parallel-Request-Schutz, analog dem Claim-Muster aus match_notifications).
CREATE TABLE IF NOT EXISTS billing_tier_change_previews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT NOT NULL,
  target_tier TEXT NOT NULL,
  amount_due_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_billing_tier_change_previews_user
  ON billing_tier_change_previews(user_id, created_at DESC);

INSERT INTO schema_migrations (filename) VALUES ('0014_billing_outbox_and_tier_change_preview.sql')
ON CONFLICT (filename) DO NOTHING;
