import type { MetadataRoute } from 'next'
import { getDb } from '@/lib/db'
import { buildCompanySlug } from '@/lib/slugify'
import { getAppUrl } from '@/lib/url'

const BASE_URL = getAppUrl()

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = [
    { url: BASE_URL, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE_URL}/registrieren`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/login`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${BASE_URL}/ratgeber`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE_URL}/branchenbuch`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE_URL}/impressum`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE_URL}/datenschutz`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE_URL}/agb`, changeFrequency: 'yearly', priority: 0.3 },
  ]

  try {
    const db = getDb()

    const articlesResult = await db.query(
      `SELECT slug, updated_at FROM guide_articles WHERE published = true`
    )
    const articleEntries: MetadataRoute.Sitemap = articlesResult.rows.map((a) => ({
      url: `${BASE_URL}/ratgeber/${a.slug}`,
      lastModified: a.updated_at,
      changeFrequency: 'monthly',
      priority: 0.6,
    }))

    const companiesResult = await db.query(
      `SELECT id, company_name FROM users
       WHERE role = 'subunternehmer' AND directory_listed = true AND subscription_status = 'active'`
    )
    const companyEntries: MetadataRoute.Sitemap = companiesResult.rows.map((c) => ({
      url: `${BASE_URL}/branchenbuch/${buildCompanySlug(c.company_name, c.id)}`,
      changeFrequency: 'monthly',
      priority: 0.5,
    }))

    return [...staticEntries, ...articleEntries, ...companyEntries]
  } catch {
    return staticEntries
  }
}
