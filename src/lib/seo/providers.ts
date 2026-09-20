import { getDb } from '@/lib/db'
import type { City } from '@/lib/seo/cities'
import { cityPlzPatterns } from '@/lib/seo/cities'
import { ensureCompanySlugs } from '@/lib/company-slug'

export interface RealProvider {
  id: string
  companySlug: string
  companyName: string
  plz: string
  ort: string
  verificationStatus: string
  avgRating: number | null
  reviewCount: number
}

/**
 * Lädt echte, aktive Anbieter für ein Gewerk in einer Stadt – ausschließlich reale Daten aus
 * der Nutzer-/Bewertungstabelle, nie erfundene Platzhalter (Phase-2 §7/§11: "Keine erfundenen
 * Bewertungen. Keine erfundenen Unternehmensdaten.").
 */
export async function getRealProviders(gewerkName: string, city: City, limit = 12): Promise<RealProvider[]> {
  const db = getDb()
  const result = await db.query(
    `SELECT u.id, u.company_slug, u.company_name, u.plz, u.ort, u.verification_status,
            (SELECT AVG(rating)::numeric(2,1) FROM reviews WHERE reviewee_id = u.id) AS avg_rating,
            (SELECT COUNT(*)::int FROM reviews WHERE reviewee_id = u.id) AS review_count
     FROM users u
     WHERE u.role = 'subunternehmer' AND u.directory_listed = true AND u.subscription_status = 'active'
       AND u.company_name IS NOT NULL
       AND $1 = ANY(u.gewerke)
       AND u.plz LIKE ANY($2::text[])
     ORDER BY review_count DESC NULLS LAST, u.company_name ASC
     LIMIT $3`,
    [gewerkName, cityPlzPatterns(city), limit]
  )
  const rowsWithSlugs = await ensureCompanySlugs(result.rows)

  return rowsWithSlugs.map((r) => ({
    id: r.id,
    companySlug: r.company_slug,
    companyName: r.company_name,
    plz: r.plz,
    ort: r.ort,
    verificationStatus: r.verification_status,
    avgRating: r.avg_rating !== null ? Number(r.avg_rating) : null,
    reviewCount: r.review_count,
  }))
}

export async function countRealProviders(gewerkName: string, city: City): Promise<number> {
  const db = getDb()
  const result = await db.query(
    `SELECT COUNT(*)::int AS count FROM users
     WHERE role = 'subunternehmer' AND directory_listed = true AND subscription_status = 'active'
       AND company_name IS NOT NULL AND $1 = ANY(gewerke) AND plz LIKE ANY($2::text[])`,
    [gewerkName, cityPlzPatterns(city)]
  )
  return result.rows[0].count
}

export async function countRealReviews(gewerkName: string, city: City): Promise<number> {
  const db = getDb()
  const result = await db.query(
    `SELECT COUNT(*)::int AS count FROM reviews r
     JOIN users u ON u.id = r.reviewee_id
     WHERE u.role = 'subunternehmer' AND u.directory_listed = true AND u.subscription_status = 'active'
       AND $1 = ANY(u.gewerke) AND u.plz LIKE ANY($2::text[])`,
    [gewerkName, cityPlzPatterns(city)]
  )
  return result.rows[0].count
}
