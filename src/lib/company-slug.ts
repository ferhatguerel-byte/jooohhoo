import { getDb } from '@/lib/db'
import { slugify } from '@/lib/slugify'

/**
 * Liefert den stabilen, kanonischen Firmen-Slug für /firma/[slug]. Anders als die alte
 * buildCompanySlug()-Berechnung (Name + ID-Präfix bei jedem Request neu erzeugt) wird der
 * Slug einmalig persistiert und ändert sich danach nicht mehr, auch wenn der Firmenname
 * später geändert wird – Voraussetzung für stabile, langfristig indexierbare URLs.
 */
export async function getOrCreateCompanySlug(userId: string, companyName: string): Promise<string> {
  const db = getDb()
  const existing = await db.query('SELECT company_slug FROM users WHERE id = $1', [userId])
  const current = existing.rows[0]?.company_slug
  if (current) return current

  const base = slugify(companyName) || 'firma'
  const candidate = `${base}-${userId.slice(0, 8)}`

  // Höchst unwahrscheinlicher Kollisionsfall (identischer Name-Slug + ID-Präfix-Kollision
  // existiert praktisch nicht, da das ID-Präfix bereits pro Nutzer eindeutig ist) – der
  // UNIQUE-Constraint auf company_slug ist dennoch die eigentliche Absicherung.
  await db.query('UPDATE users SET company_slug = $1 WHERE id = $2', [candidate, userId])
  return candidate
}

/** Backfillt company_slug für Zeilen, die noch keinen haben (z.B. ältere Datensätze). */
export async function ensureCompanySlugs<T extends { id: string; company_name: string; company_slug: string | null }>(
  rows: T[]
): Promise<(T & { company_slug: string })[]> {
  return Promise.all(
    rows.map(async (row) => ({
      ...row,
      company_slug: row.company_slug || (await getOrCreateCompanySlug(row.id, row.company_name)),
    }))
  )
}

export async function getCompanyBySlug(slug: string): Promise<{ id: string } | null> {
  const db = getDb()
  const result = await db.query(
    `SELECT id FROM users WHERE company_slug = $1 AND role = 'subunternehmer'
     AND directory_listed = true AND subscription_status = 'active'`,
    [slug]
  )
  return result.rows[0] || null
}
