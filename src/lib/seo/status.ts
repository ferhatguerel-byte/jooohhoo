import { getDb } from '@/lib/db'
import { computeQualityScore, suggestStatusFromScore, type QualityScoreInput } from '@/lib/seo/quality-score'

export type SeoPageType =
  | 'handwerker'
  | 'handwerker_gewerk'
  | 'nachunternehmer'
  | 'nachunternehmer_gewerk'
  | 'leistung'
  | 'baukosten'
  | 'branchenbuch_gewerk'
  | 'branchenbuch_stadt'
  | 'branchenbuch_kombi'

export type SeoPageStatus = 'DRAFT' | 'REVIEW' | 'INDEXABLE' | 'NOINDEX'

export interface SeoPageKey {
  pageType: SeoPageType
  gewerkSlug?: string
  citySlug?: string
  leistungSlug?: string
}

export interface SeoPageEvaluation {
  status: SeoPageStatus
  statusSource: 'AUTO' | 'ADMIN'
  score: number
  breakdown: Record<string, number>
  missingReasons: Record<string, string>
}

export interface SeoPageRecord extends SeoPageKey {
  id: string
  status: SeoPageStatus
  statusSource: 'AUTO' | 'ADMIN'
  score: number | null
  breakdown: Record<string, number>
  missingReasons: Record<string, string>
  adminNote: string | null
  updatedAt: string
}

/**
 * Bewertet eine Landingpage-Kombination anhand des Quality-Scores und schreibt das Ergebnis
 * fort. Ein automatisch (AUTO) ermittelter Score kann höchstens zu REVIEW führen – niemals
 * automatisch zu INDEXABLE (siehe quality-score.ts). Wurde der Status zuvor von einem Admin
 * explizit gesetzt (status_source = 'ADMIN'), bleibt dieser unangetastet; nur der Score selbst
 * wird zu Informationszwecken aktualisiert.
 */
export async function evaluateLandingPage(
  key: SeoPageKey,
  input: QualityScoreInput
): Promise<SeoPageEvaluation> {
  const db = getDb()
  const { score, breakdown, missingReasons } = computeQualityScore(input)
  const suggestion = suggestStatusFromScore(score)
  const autoStatus: SeoPageStatus = suggestion === 'INDEXABLE_CANDIDATE' ? 'REVIEW' : suggestion

  const existing = await db.query(
    `SELECT status, status_source FROM seo_landing_pages
     WHERE page_type = $1 AND COALESCE(gewerk_slug,'') = COALESCE($2,'')
       AND COALESCE(city_slug,'') = COALESCE($3,'') AND COALESCE(leistung_slug,'') = COALESCE($4,'')`,
    [key.pageType, key.gewerkSlug ?? null, key.citySlug ?? null, key.leistungSlug ?? null]
  )
  const current = existing.rows[0]
  const statusSource: 'AUTO' | 'ADMIN' = current?.status_source === 'ADMIN' ? 'ADMIN' : 'AUTO'
  const status: SeoPageStatus = statusSource === 'ADMIN' ? current.status : autoStatus

  await db.query(
    `INSERT INTO seo_landing_pages (page_type, gewerk_slug, city_slug, leistung_slug, status, status_source, quality_score, quality_breakdown, evaluated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
     ON CONFLICT (page_type, (COALESCE(gewerk_slug,'')), (COALESCE(city_slug,'')), (COALESCE(leistung_slug,'')))
     DO UPDATE SET quality_score = $7, quality_breakdown = $8, evaluated_at = now(),
       status = CASE WHEN seo_landing_pages.status_source = 'ADMIN' THEN seo_landing_pages.status ELSE $5 END,
       updated_at = now()`,
    [
      key.pageType,
      key.gewerkSlug ?? null,
      key.citySlug ?? null,
      key.leistungSlug ?? null,
      autoStatus,
      statusSource,
      score,
      JSON.stringify({ breakdown, missingReasons }),
    ]
  )

  return { status, statusSource, score, breakdown, missingReasons }
}

/**
 * Admin-Override: setzt den Status explizit und sperrt ihn gegen künftige automatische
 * Neubewertung. Nur diese Funktion darf einen Status auf INDEXABLE setzen (aufgerufen aus der
 * Admin-API unter /api/admin/seo, die requireAdminApi() voraussetzt) – evaluateLandingPage()
 * kann das nicht.
 */
export async function setAdminSeoStatus(key: SeoPageKey, status: SeoPageStatus, adminNote?: string): Promise<void> {
  const db = getDb()
  await db.query(
    `INSERT INTO seo_landing_pages (page_type, gewerk_slug, city_slug, leistung_slug, status, status_source, admin_note)
     VALUES ($1, $2, $3, $4, $5, 'ADMIN', $6)
     ON CONFLICT (page_type, (COALESCE(gewerk_slug,'')), (COALESCE(city_slug,'')), (COALESCE(leistung_slug,'')))
     DO UPDATE SET status = $5, status_source = 'ADMIN',
       admin_note = COALESCE($6, seo_landing_pages.admin_note), updated_at = now()`,
    [key.pageType, key.gewerkSlug ?? null, key.citySlug ?? null, key.leistungSlug ?? null, status, adminNote ?? null]
  )
}

/** Speichert nur die Admin-Notiz, ohne Status oder status_source zu verändern. */
export async function saveAdminNote(key: SeoPageKey, adminNote: string): Promise<void> {
  const db = getDb()
  await db.query(
    `UPDATE seo_landing_pages SET admin_note = $5, updated_at = now()
     WHERE page_type = $1 AND COALESCE(gewerk_slug,'') = COALESCE($2,'')
       AND COALESCE(city_slug,'') = COALESCE($3,'') AND COALESCE(leistung_slug,'') = COALESCE($4,'')`,
    [key.pageType, key.gewerkSlug ?? null, key.citySlug ?? null, key.leistungSlug ?? null, adminNote]
  )
}

/** Setzt eine Kombination zurück auf automatische Bewertung (nächster evaluateLandingPage-Lauf entscheidet wieder selbst). */
export async function clearAdminOverride(key: SeoPageKey): Promise<void> {
  const db = getDb()
  await db.query(
    `UPDATE seo_landing_pages SET status_source = 'AUTO', updated_at = now()
     WHERE page_type = $1 AND COALESCE(gewerk_slug,'') = COALESCE($2,'')
       AND COALESCE(city_slug,'') = COALESCE($3,'') AND COALESCE(leistung_slug,'') = COALESCE($4,'')`,
    [key.pageType, key.gewerkSlug ?? null, key.citySlug ?? null, key.leistungSlug ?? null]
  )
}

export function isIndexableStatus(status: SeoPageStatus): boolean {
  return status === 'INDEXABLE'
}

function mapRow(r: {
  id: string
  page_type: SeoPageType
  gewerk_slug: string | null
  city_slug: string | null
  leistung_slug: string | null
  status: SeoPageStatus
  status_source: 'AUTO' | 'ADMIN'
  quality_score: number | null
  quality_breakdown: { breakdown?: Record<string, number>; missingReasons?: Record<string, string> } | null
  admin_note: string | null
  updated_at: string
}): SeoPageRecord {
  return {
    id: r.id,
    pageType: r.page_type,
    gewerkSlug: r.gewerk_slug ?? undefined,
    citySlug: r.city_slug ?? undefined,
    leistungSlug: r.leistung_slug ?? undefined,
    status: r.status,
    statusSource: r.status_source,
    score: r.quality_score,
    breakdown: r.quality_breakdown?.breakdown ?? {},
    missingReasons: r.quality_breakdown?.missingReasons ?? {},
    adminNote: r.admin_note,
    updatedAt: r.updated_at,
  }
}

export interface SeoLandingPageFilters {
  status?: SeoPageStatus
  pageType?: SeoPageType
  gewerkSlug?: string
  citySlug?: string
  minScore?: number
}

export async function listSeoLandingPages(filters: SeoLandingPageFilters = {}): Promise<SeoPageRecord[]> {
  const db = getDb()
  const conditions: string[] = []
  const params: unknown[] = []

  if (filters.status) {
    params.push(filters.status)
    conditions.push(`status = $${params.length}`)
  }
  if (filters.pageType) {
    params.push(filters.pageType)
    conditions.push(`page_type = $${params.length}`)
  }
  if (filters.gewerkSlug) {
    params.push(filters.gewerkSlug)
    conditions.push(`gewerk_slug = $${params.length}`)
  }
  if (filters.citySlug) {
    params.push(filters.citySlug)
    conditions.push(`city_slug = $${params.length}`)
  }
  if (typeof filters.minScore === 'number') {
    params.push(filters.minScore)
    conditions.push(`quality_score >= $${params.length}`)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const result = await db.query(
    `SELECT id, page_type, gewerk_slug, city_slug, leistung_slug, status, status_source,
            quality_score, quality_breakdown, admin_note, updated_at
     FROM seo_landing_pages ${where} ORDER BY updated_at DESC LIMIT 500`,
    params
  )
  return result.rows.map(mapRow)
}

export async function getSeoLandingPageById(id: string): Promise<SeoPageRecord | null> {
  const db = getDb()
  const result = await db.query(
    `SELECT id, page_type, gewerk_slug, city_slug, leistung_slug, status, status_source,
            quality_score, quality_breakdown, admin_note, updated_at
     FROM seo_landing_pages WHERE id = $1`,
    [id]
  )
  return result.rows[0] ? mapRow(result.rows[0]) : null
}
