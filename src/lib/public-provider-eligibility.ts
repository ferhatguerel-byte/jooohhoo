/**
 * Admin-Unternehmensverwaltung – zentrale Eligibility-Regel für öffentlich sichtbare Unternehmen.
 *
 * Bislang war die Bedingung "role = 'subunternehmer' AND directory_listed = true AND
 * subscription_status = 'active'" an 7 Stellen (branchenbuch/page.tsx,
 * branchenbuch/[slug]/page.tsx, BranchenbuchGewerkOrStadtPage.tsx, firma/[slug]/page.tsx,
 * lib/seo/providers.ts (3x), sitemap.ts, company-slug.ts) jeweils separat als Roh-SQL kopiert –
 * und KEINE davon prüfte account_status. Ein gesperrtes Unternehmen blieb dadurch überall
 * öffentlich sichtbar. Diese Datei ist ab sofort die einzige Quelle der Wahrheit für diese
 * Bedingung; alle genannten Stellen nutzen ausschließlich publicProviderSqlCondition().
 *
 * Bewusst als reiner SQL-Fragment-Baustein (nicht als JS-seitiger Post-Filter): alle
 * Aufrufstellen filtern bereits heute per SQL, ein zusätzlicher Filter in JS würde entweder
 * doppelte Logik erzeugen oder Pagination/LIMIT-Queries verfälschen.
 */
export function publicProviderSqlCondition(alias?: string): string {
  const p = alias ? `${alias}.` : ''
  return `${p}role = 'subunternehmer' AND ${p}account_status = 'active' AND ${p}directory_listed = true AND ${p}subscription_status = 'active'`
}
