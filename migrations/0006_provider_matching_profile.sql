-- Migration 0006: Phase 3.2 – Provider Matching Profile (Grundlage für spätere Matching Engine).
--
-- Rein additive, optionale Felder auf users. NULL bedeutet "keine Angabe" und darf im
-- künftigen Matching NIEMALS als negative Bewertung interpretiert werden (siehe Phase-3.1-Audit).
-- Speichereinheit für min_project_size/max_project_size: ganze Euro, konsistent mit den
-- bestehenden Geldfeldern jobs.budget_min/max, jobs.estimated_cost_min/max, offers.price
-- (dort wird ebenfalls nicht in Cent, sondern in vollen Euro gespeichert/angezeigt).
--
-- Bewusst NICHT Teil dieser Migration (siehe Phase-3.1-Architekturbericht): job_matches,
-- provider_qualifications, Kapazität/Verfügbarkeit, Geo-Koordinaten – diese Felder erfinden
-- keine Matching-Logik, sie sind reine, optionale Präferenzangaben des Unternehmers.

ALTER TABLE users ADD COLUMN IF NOT EXISTS service_radius_km INTEGER NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS min_project_size INTEGER NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS max_project_size INTEGER NULL;

INSERT INTO schema_migrations (filename) VALUES ('0006_provider_matching_profile.sql')
ON CONFLICT (filename) DO NOTHING;
