-- Migration 0013: Admin-Unternehmensverwaltung – "gelöscht" als dritter account_status-Wert.
--
-- Erweitert account_status additiv um 'deleted' (bisher 'active' | 'suspended'). Eine echte
-- physische Löschung von users-Zeilen ist wegen der zahlreichen historischen Fremdschlüssel
-- (offers, reviews, offer_messages, admin_warnings, support_tickets, jobs.awarded_subunternehmer_id
-- ohne ON DELETE-Klausel = RESTRICT) nicht sicher möglich, ohne fremde Daten anderer Nutzer zu
-- zerstören oder an einer FK-Verletzung zu scheitern. Stattdessen wird die Zeile beim Löschen
-- anonymisiert und auf account_status='deleted' gesetzt (siehe
-- src/app/api/admin/users/[id]/delete/route.ts) – dieselbe zentrale Eligibility-Regel
-- (src/lib/public-provider-eligibility.ts), die bereits 'suspended' aus allen öffentlichen
-- Flächen ausschließt, schließt dadurch automatisch auch 'deleted' aus, ohne eine zweite
-- Sichtbarkeitslogik zu benötigen.
--
-- deleted_at dokumentiert den Zeitpunkt und macht die Lösch-Route idempotent (WHERE deleted_at
-- IS NULL beim UPDATE – ein zweiter Löschversuch trifft 0 Zeilen statt eine zweite Nebenwirkung
-- auszulösen).
--
-- WICHTIG (Postgres-Einschränkung): ALTER TYPE ... ADD VALUE muss vor der ersten Verwendung des
-- neuen Werts committet sein. Diese Migration selbst SCHREIBT den Wert 'deleted' nirgends in eine
-- Zeile – sie fügt ihn nur zum Enum hinzu. Der erste tatsächliche Schreibzugriff mit 'deleted'
-- erfolgt aus einer späteren, eigenständigen Transaktion (der Delete-Route), daher ist ein
-- einzelner Migrationslauf hier unproblematisch.
ALTER TYPE account_status ADD VALUE IF NOT EXISTS 'deleted';

ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

INSERT INTO schema_migrations (filename) VALUES ('0013_account_status_deleted.sql')
ON CONFLICT (filename) DO NOTHING;
