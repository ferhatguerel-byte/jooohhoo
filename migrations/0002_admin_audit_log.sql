-- Migration 0002: Admin-Audit-Log – protokolliert sicherheitsrelevante Admin-Aktionen
-- (Sperren/Entsperren, Verifizierung, Abo-Änderungen durch Admin, Mahnungen, Gewerke-Sperren, CMS).

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin ON admin_audit_log(admin_id, created_at);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target ON admin_audit_log(target_type, target_id);

INSERT INTO schema_migrations (filename) VALUES ('0002_admin_audit_log.sql')
ON CONFLICT (filename) DO NOTHING;
