import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getGewerkSeoBySlug } from '@/lib/seo/gewerke-seo'
import { getCityBySlug } from '@/lib/seo/cities'
import { extractIdPrefixFromSlug } from '@/lib/slugify'
import { getDb } from '@/lib/db'
import { getOrCreateCompanySlug } from '@/lib/company-slug'
import BranchenbuchGewerkOrStadtPage, { buildBranchenbuchMetadata } from '@/components/seo/BranchenbuchGewerkOrStadtPage'

/**
 * Ein einzelnes dynamisches Segment muss hier drei frühere/neue Bedeutungen bedienen, um keine
 * URL-Duplikate zu erzeugen (Phase-2 §3):
 *  1. Gewerk-Slug (z.B. /branchenbuch/trockenbau) -> Gewerk-Verzeichnis
 *  2. Stadt-Slug (z.B. /branchenbuch/berlin) -> Stadt-Verzeichnis
 *  3. Alte Firmenprofil-Slugs (z.B. /branchenbuch/mustermann-gmbh-1a2b3c4d) -> 301-Redirect auf
 *     die neue kanonische Profil-URL /firma/[slug] (Firmenprofile leben jetzt dort).
 */
async function resolveLegacyCompanyRedirect(slug: string): Promise<string | null> {
  const idPrefix = extractIdPrefixFromSlug(slug)
  if (!idPrefix) return null

  const db = getDb()
  const result = await db.query(
    `SELECT id, company_name FROM users
     WHERE role = 'subunternehmer' AND directory_listed = true AND subscription_status = 'active'
       AND id::text LIKE $1 LIMIT 1`,
    [`${idPrefix}%`]
  )
  const company = result.rows[0]
  if (!company) return null

  const companySlug = await getOrCreateCompanySlug(company.id, company.company_name)
  return `/firma/${companySlug}`
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const gewerk = getGewerkSeoBySlug(slug)
  if (gewerk) return buildBranchenbuchMetadata({ gewerk })
  const city = getCityBySlug(slug)
  if (city) return buildBranchenbuchMetadata({ city })
  return {}
}

export default async function BranchenbuchSlugResolverPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const gewerk = getGewerkSeoBySlug(slug)
  if (gewerk) return <BranchenbuchGewerkOrStadtPage gewerk={gewerk} />

  const city = getCityBySlug(slug)
  if (city) return <BranchenbuchGewerkOrStadtPage city={city} />

  const redirectTarget = await resolveLegacyCompanyRedirect(slug)
  if (redirectTarget) redirect(redirectTarget)

  notFound()
}
