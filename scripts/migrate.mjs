#!/usr/bin/env node
/**
 * Wendet alle noch nicht angewendeten Migrationen aus /migrations in Dateinamen-Reihenfolge an.
 * Jede Migration ist idempotent (nur IF NOT EXISTS) und trägt sich am Ende selbst in
 * schema_migrations ein – das Skript kann daher gefahrlos mehrfach ausgeführt werden.
 *
 * Nutzung:
 *   DATABASE_URL="postgres://..." node scripts/migrate.mjs
 *
 * Alternativ (wie bisher in diesem Projekt üblich): den Inhalt einer einzelnen Migrationsdatei
 * direkt in den Neon SQL Editor einfügen und ausführen – jede Datei trägt sich dabei selbst
 * in schema_migrations ein, ein separater Skriptlauf ist dafür nicht zwingend nötig.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import pg from 'pg'

const { Pool } = pg
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const migrationsDir = path.join(__dirname, '..', 'migrations')

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('DATABASE_URL ist nicht gesetzt.')
    process.exit(1)
  }

  const pool = new Pool({ connectionString: databaseUrl })

  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    filename TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`)

  const appliedResult = await pool.query('SELECT filename FROM schema_migrations')
  const applied = new Set(appliedResult.rows.map((r) => r.filename))

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`- übersprungen (bereits angewendet): ${file}`)
      continue
    }

    const sql = readFileSync(path.join(migrationsDir, file), 'utf8')
    console.log(`- wende an: ${file}`)
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(sql)
      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      console.error(`Fehler in ${file}:`, err instanceof Error ? err.message : err)
      process.exit(1)
    } finally {
      client.release()
    }
  }

  await pool.end()
  console.log('Fertig.')
}

main()
