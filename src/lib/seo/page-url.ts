import type { SeoPageKey } from '@/lib/seo/status'

/** Leitet den öffentlichen URL-Pfad einer Landingpage-Kombination aus ihrem Typ + Slugs ab. */
export function seoPageUrlPath(key: SeoPageKey): string | null {
  const { pageType, gewerkSlug, citySlug, leistungSlug } = key
  switch (pageType) {
    case 'handwerker':
      return gewerkSlug && citySlug ? `/handwerker/${gewerkSlug}/${citySlug}` : null
    case 'handwerker_gewerk':
      return gewerkSlug ? `/handwerker/${gewerkSlug}` : null
    case 'nachunternehmer':
      return gewerkSlug && citySlug ? `/nachunternehmer/${gewerkSlug}/${citySlug}` : null
    case 'nachunternehmer_gewerk':
      return gewerkSlug ? `/nachunternehmer/${gewerkSlug}` : null
    case 'leistung':
      return leistungSlug ? `/leistungen/${leistungSlug}` : null
    case 'baukosten':
      return leistungSlug ? `/baukosten/${leistungSlug}` : null
    case 'branchenbuch_gewerk':
      return gewerkSlug ? `/branchenbuch/${gewerkSlug}` : null
    case 'branchenbuch_stadt':
      return citySlug ? `/branchenbuch/${citySlug}` : null
    case 'branchenbuch_kombi':
      return gewerkSlug && citySlug ? `/branchenbuch/${gewerkSlug}/${citySlug}` : null
    default:
      return null
  }
}
