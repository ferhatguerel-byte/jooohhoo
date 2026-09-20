import type { MetadataRoute } from 'next'
import { getDb } from '@/lib/db'
import { getAppUrl } from '@/lib/url'
import { getActiveGewerkeSeo } from '@/lib/seo/gewerke-seo'
import { getActiveCities } from '@/lib/seo/cities'
import { getActiveLeistungen } from '@/lib/seo/leistungen'

const BASE_URL = getAppUrl()

export const dynamic = 'force-dynamic'

/**
 * Nimmt nur öffentliche, indexierbare, kanonische URLs auf (Phase-2 §16). Insbesondere:
 * - /handwerker/[gewerk]/[stadt] und /nachunternehmer/[gewerk]/[stadt] NUR, wenn das Quality
 *   Gate die Kombination tatsächlich auf status = 'INDEXABLE' gesetzt hat (nie automatisch
 *   allein aufgrund des Scores, siehe src/lib/seo/status.ts).
 * - /baukosten/[leistung] wird NICHT aufgenommen, solange keine Leistung echte Kostendaten hat.
 * - /branchenbuch/[gewerk]/[stadt]-Kombinationen werden aktuell nicht aufgenommen (noch nicht
 *   an das Quality Gate angebunden) – siehe Abschlussbericht "verbleibende Risiken".
 * - Keine Dashboard-/Admin-/API-Routen, keine Filter-Query-Kombinationen.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const gewerke = getActiveGewerkeSeo()
  const cities = getActiveCities()
  const leistungen = getActiveLeistungen()

  const staticEntries: MetadataRoute.Sitemap = [
    { url: BASE_URL, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE_URL}/registrieren`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/login`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${BASE_URL}/ratgeber`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE_URL}/branchenbuch`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE_URL}/handwerker`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE_URL}/nachunternehmer`, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${BASE_URL}/leistungen`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/baukosten`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/impressum`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE_URL}/datenschutz`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE_URL}/agb`, changeFrequency: 'yearly', priority: 0.3 },
  ]

  // Kleine, feste Kategorie-Seiten (kein kombinatorisches Wachstum): Gewerk-/Branchenbuch-Übersichten.
  const gewerkCategoryEntries: MetadataRoute.Sitemap = gewerke.flatMap((g) => [
    { url: `${BASE_URL}/handwerker/${g.slug}`, changeFrequency: 'monthly' as const, priority: 0.6 },
    { url: `${BASE_URL}/nachunternehmer/${g.slug}`, changeFrequency: 'monthly' as const, priority: 0.5 },
    { url: `${BASE_URL}/branchenbuch/${g.slug}`, changeFrequency: 'weekly' as const, priority: 0.5 },
  ])
  const cityCategoryEntries: MetadataRoute.Sitemap = cities.map((c) => ({
    url: `${BASE_URL}/branchenbuch/${c.slug}`,
    changeFrequency: 'weekly',
    priority: 0.5,
  }))
  const leistungEntries: MetadataRoute.Sitemap = leistungen.map((l) => ({
    url: `${BASE_URL}/leistungen/${l.slug}`,
    changeFrequency: 'monthly',
    priority: 0.5,
  }))

  try {
    const db = getDb()

    const articlesResult = await db.query(`SELECT slug, updated_at FROM guide_articles WHERE published = true`)
    const articleEntries: MetadataRoute.Sitemap = articlesResult.rows.map((a) => ({
      url: `${BASE_URL}/ratgeber/${a.slug}`,
      lastModified: a.updated_at,
      changeFrequency: 'monthly',
      priority: 0.6,
    }))

    const companiesResult = await db.query(
      `SELECT company_slug FROM users
       WHERE role = 'subunternehmer' AND directory_listed = true AND subscription_status = 'active'
         AND company_slug IS NOT NULL`
    )
    const companyEntries: MetadataRoute.Sitemap = companiesResult.rows.map((c) => ({
      url: `${BASE_URL}/firma/${c.company_slug}`,
      changeFrequency: 'monthly',
      priority: 0.5,
    }))

    // Nur Gewerk×Stadt-Kombinationen, die das Quality Gate tatsächlich freigegeben hat.
    const indexablePagesResult = await db.query(
      `SELECT page_type, gewerk_slug, city_slug FROM seo_landing_pages
       WHERE status = 'INDEXABLE' AND page_type IN ('handwerker', 'nachunternehmer')
         AND gewerk_slug IS NOT NULL AND city_slug IS NOT NULL`
    )
    const landingPageEntries: MetadataRoute.Sitemap = indexablePagesResult.rows.map((r) => ({
      url: `${BASE_URL}/${r.page_type === 'handwerker' ? 'handwerker' : 'nachunternehmer'}/${r.gewerk_slug}/${r.city_slug}`,
      changeFrequency: 'weekly',
      priority: 0.65,
    }))

    return [
      ...staticEntries,
      ...gewerkCategoryEntries,
      ...cityCategoryEntries,
      ...leistungEntries,
      ...articleEntries,
      ...companyEntries,
      ...landingPageEntries,
    ]
  } catch {
    return [...staticEntries, ...gewerkCategoryEntries, ...cityCategoryEntries, ...leistungEntries]
  }
}
