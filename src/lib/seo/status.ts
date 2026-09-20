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
  const { score, breakdown } = computeQualityScore(input)
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
      JSON.stringify(breakdown),
    ]
  )

  return { status, statusSource, score, breakdown }
}

/** Admin-Override: setzt den Status explizit und sperrt ihn gegen künftige automatische Neubewertung. */
export async function setAdminSeoStatus(key: SeoPageKey, status: SeoPageStatus): Promise<void> {
  const db = getDb()
  await db.query(
    `INSERT INTO seo_landing_pages (page_type, gewerk_slug, city_slug, leistung_slug, status, status_source)
     VALUES ($1, $2, $3, $4, $5, 'ADMIN')
     ON CONFLICT (page_type, (COALESCE(gewerk_slug,'')), (COALESCE(city_slug,'')), (COALESCE(leistung_slug,'')))
     DO UPDATE SET status = $5, status_source = 'ADMIN', updated_at = now()`,
    [key.pageType, key.gewerkSlug ?? null, key.citySlug ?? null, key.leistungSlug ?? null, status]
  )
}

export function isIndexableStatus(status: SeoPageStatus): boolean {
  return status === 'INDEXABLE'
}

export async function listSeoLandingPages(): Promise<
  (SeoPageKey & { status: SeoPageStatus; statusSource: 'AUTO' | 'ADMIN'; score: number | null; updatedAt: string })[]
> {
  const db = getDb()
  const result = await db.query(
    `SELECT page_type, gewerk_slug, city_slug, leistung_slug, status, status_source, quality_score, updated_at
     FROM seo_landing_pages ORDER BY updated_at DESC`
  )
  return result.rows.map((r) => ({
    pageType: r.page_type,
    gewerkSlug: r.gewerk_slug ?? undefined,
    citySlug: r.city_slug ?? undefined,
    leistungSlug: r.leistung_slug ?? undefined,
    status: r.status,
    statusSource: r.status_source,
    score: r.quality_score,
    updatedAt: r.updated_at,
  }))
}
