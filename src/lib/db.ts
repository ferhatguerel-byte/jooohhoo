import { Pool } from 'pg'

let pool: Pool | undefined

function getConnectionString(): string {
  const url = process.env.DATABASE_URL
  if (url) return url

  if (process.env.NODE_ENV !== 'production') {
    return 'postgres://postgres:devpassword@localhost:5432/bauversus'
  }

  // Phase 5: kein stiller Fallback in Production (dasselbe Prinzip wie SESSION_SECRET/
  // NEXT_PUBLIC_APP_URL/CRON_SECRET) – ohne echte DATABASE_URL darf die App in Production
  // nicht scheinbar funktionsfähig gegen eine nicht existente lokale Datenbank laufen.
  throw new Error(
    'DATABASE_URL ist nicht gesetzt. In Production darf hierfür keine lokale Entwicklungs-' +
      'Datenbank als stiller Fallback verwendet werden. Bitte die Umgebungsvariable in den ' +
      'Vercel-Projekteinstellungen setzen.'
  )
}

export function getDb(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: getConnectionString() })
  }
  return pool
}
