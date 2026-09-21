-- Migration 0005: Admin-Notiz für SEO-Landingpages (Phase 2.1 – SEO Admin UI).
-- Erlaubt einem Admin, eine kurze Begründung/Notiz zu einer Status-Entscheidung zu
-- hinterlegen (z.B. "Anbieterlage geprüft am ..., manuell freigegeben").

ALTER TABLE seo_landing_pages ADD COLUMN IF NOT EXISTS admin_note TEXT;

INSERT INTO schema_migrations (filename) VALUES ('0005_seo_admin_notes.sql')
ON CONFLICT (filename) DO NOTHING;
