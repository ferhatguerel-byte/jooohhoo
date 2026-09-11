import { Pool } from 'pg'

let pool: Pool | undefined

export function getDb(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgres://postgres:devpassword@localhost:5432/baupartner24',
    })
  }
  return pool
}
