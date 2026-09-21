-- Migration 0007: Phase 3.5 – Match Storage/Persistence.
--
-- Speichert genau einen aktuellen Match-Snapshot pro job_id×provider_id (kein Verlauf, keine
-- Versionierung in dieser Phase). Bei jedem runMatchingForJob()-Lauf wird der aktuelle Snapshot
-- per UPSERT aktualisiert; nicht mehr aktuelle Kombinationen werden gezielt gelöscht statt als
-- veraltet stehen zu bleiben (siehe src/lib/matching/run-matching.ts).
--
-- Sowohl eligible als auch durch den Hard Filter ausgeschlossene Kandidaten werden gespeichert
-- (Phase-3.5-Entscheidung §6): so kann später nachvollzogen werden, warum ein Unternehmen für
-- einen Job nicht berücksichtigt wurde. Es werden ausschließlich Provider gespeichert, die die
-- vorgelagerte SQL-Kandidaten-Vorfilterung (role/account_status/subscription_status/Hauptgewerk,
-- siehe fetchJobAndCandidateProviders) tatsächlich erreicht haben – kein "SELECT alle users".
--
-- matched_factors/missing_data enthalten ausschließlich technische Matching-Daten (Faktor->Punkte,
-- lesbare Missing-Data-Texte) – keine personenbezogenen Daten. Die globale Score-Konfiguration
-- (Gewichte/Stufen) wird NICHT redundant je Zeile gespeichert, sie bleibt zentral in
-- src/lib/matching/score-config.ts.

CREATE TABLE IF NOT EXISTS job_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  match_score SMALLINT NULL,
  matched_factors JSONB NOT NULL DEFAULT '{}',
  missing_data JSONB NOT NULL DEFAULT '[]',
  excluded BOOLEAN NOT NULL DEFAULT false,
  exclusion_reason TEXT NULL,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT job_matches_score_range CHECK (match_score IS NULL OR (match_score >= 0 AND match_score <= 100)),
  -- Kombiniert beide aus der Vorgabe geforderten Regeln in einem CHECK: excluded=true erlaubt nur
  -- match_score IS NULL (exclusion_reason ist dabei frei), excluded=false erlaubt nur
  -- exclusion_reason IS NULL (match_score ist dabei frei) – kein widersprüchlicher Zustand möglich.
  CONSTRAINT job_matches_exclusion_consistency CHECK (
    (excluded = true AND match_score IS NULL) OR (excluded = false AND exclusion_reason IS NULL)
  ),
  UNIQUE (job_id, provider_id)
);

CREATE INDEX IF NOT EXISTS idx_job_matches_job_score ON job_matches(job_id, match_score DESC);
CREATE INDEX IF NOT EXISTS idx_job_matches_provider_calculated ON job_matches(provider_id, calculated_at DESC);

INSERT INTO schema_migrations (filename) VALUES ('0007_job_matches.sql')
ON CONFLICT (filename) DO NOTHING;
