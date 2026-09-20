-- Migration 0003: Private-File-Storage – Zuordnungstabelle für sensible Uploads
-- (Gewerbeanmeldung, Meisterbrief, Haftpflichtversicherung, Auftrags-Anhänge).
--
-- Diese Dateien liegen ab sofort als 'private' im Blob-Storage (kein direkter, öffentlich
-- erratbarer Link). Der Zugriff läuft ausschließlich über /api/files/[id], das bei jedem
-- Aufruf serverseitig prüft, ob der angemeldete Nutzer tatsächlich berechtigt ist.

CREATE TABLE IF NOT EXISTS private_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pathname TEXT NOT NULL UNIQUE,
  original_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('qualification_file', 'job_attachment')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_private_files_uploaded_by ON private_files(uploaded_by);

INSERT INTO schema_migrations (filename) VALUES ('0003_private_files.sql')
ON CONFLICT (filename) DO NOTHING;
