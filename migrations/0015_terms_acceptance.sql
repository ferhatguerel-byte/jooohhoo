-- Migration 0015: Phase 2E – Nachweis der AGB-/Datenschutz-Zustimmung bei Registrierung.
--
-- Rein additiv, idempotent. KEINE rückwirkende Befüllung für Bestandsnutzer – deren
-- terms_accepted_at/terms_version bleiben bewusst NULL (es gibt keinen verlässlichen Weg, eine
-- historische Zustimmung nachträglich zu erfinden; siehe Verbraucherrecht-Audit Phase 2C).
--
-- terms_version referenziert die zum Zeitpunkt der Registrierung gültige
-- CURRENT_TERMS_VERSION-Konstante (siehe src/lib/legal/terms-version.ts), nicht den vollständigen
-- AGB-Text selbst (kein Text-Snapshot in dieser Phase).

ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_version TEXT NULL;

INSERT INTO schema_migrations (filename) VALUES ('0015_terms_acceptance.sql')
ON CONFLICT (filename) DO NOTHING;
