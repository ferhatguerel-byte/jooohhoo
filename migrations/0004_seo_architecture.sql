-- Migration 0004: Technische Grundlage für Phase 2 (SEO-Architektur).
--
-- 1. Stabiler, unveränderlicher Firmen-Slug für die kanonische Profil-URL /firma/[slug].
--    Bisher wurde der Slug bei jedem Request aus dem (änderbaren) Firmennamen neu berechnet
--    (buildCompanySlug) – das ist für kanonische, langfristig indexierte URLs ungeeignet.
--    Der Wert wird lazy beim ersten Zugriff befüllt (siehe src/lib/company-slug.ts), nicht
--    hier per SQL aus dem Namen berechnet.
ALTER TABLE users ADD COLUMN IF NOT EXISTS company_slug TEXT UNIQUE;
CREATE INDEX IF NOT EXISTS idx_users_company_slug ON users(company_slug);

-- 2. Status + Quality-Score-Tracking für programmatisch erzeugbare SEO-Landingpages
-- (Gewerk×Stadt, Gewerk×Stadt-Nachunternehmer, Leistung, Leistung×Stadt, Branchenbuch-Facetten).
-- Eine Zeile pro potenzieller Seite; die Seite selbst wird erst bei status = 'INDEXABLE'
-- indexierbar (siehe src/lib/seo/quality-gate.ts) – der Score allein entscheidet nie automatisch.
DO $$ BEGIN
  CREATE TYPE seo_page_status AS ENUM ('DRAFT', 'REVIEW', 'INDEXABLE', 'NOINDEX');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS seo_landing_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_type TEXT NOT NULL CHECK (page_type IN (
    'handwerker', 'handwerker_gewerk', 'nachunternehmer', 'nachunternehmer_gewerk',
    'leistung', 'baukosten', 'branchenbuch_gewerk', 'branchenbuch_stadt', 'branchenbuch_kombi'
  )),
  gewerk_slug TEXT,
  city_slug TEXT,
  leistung_slug TEXT,
  status seo_page_status NOT NULL DEFAULT 'DRAFT',
  status_source TEXT NOT NULL DEFAULT 'AUTO' CHECK (status_source IN ('AUTO', 'ADMIN')),
  quality_score INTEGER,
  quality_breakdown JSONB NOT NULL DEFAULT '{}',
  evaluated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Verhindert doppelte Zeilen für dieselbe Seiten-Kombination (Duplicate-URL-Schutz auf DB-Ebene).
-- COALESCE gegen NULL-Segmente, da Postgres NULL in UNIQUE-Constraints sonst als "verschieden" behandelt.
CREATE UNIQUE INDEX IF NOT EXISTS idx_seo_landing_pages_unique ON seo_landing_pages (
  page_type,
  COALESCE(gewerk_slug, ''),
  COALESCE(city_slug, ''),
  COALESCE(leistung_slug, '')
);
CREATE INDEX IF NOT EXISTS idx_seo_landing_pages_status ON seo_landing_pages(status);

INSERT INTO schema_migrations (filename) VALUES ('0004_seo_architecture.sql')
ON CONFLICT (filename) DO NOTHING;
