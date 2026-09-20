/**
 * Zentrale Location-Struktur für SEO-Landingpages. Startet bewusst mit den größten deutschen
 * Städten statt einer vollständigen Städteliste ("Keine tausenden Städte blind erzeugen",
 * Phase-2-Vorgabe §5). Die Struktur ist so angelegt, dass sie später um alle deutschen
 * Städte/Gemeinden erweiterbar ist, ohne Breaking Changes an Verbrauchern dieses Moduls.
 *
 * `postalCodePrefixes` sind 2-stellige PLZ-Leitzonen (wie in src/lib/plz-geo.ts) – eine grobe
 * Näherung, keine exakte Stadtgrenze (einzelne Postleitzahlen am Stadtrand können in eine
 * Nachbarzone fallen). Ausreichend, um reale Anbieter aus der Region einer Stadt zu ermitteln.
 */
export interface City {
  id: string
  slug: string
  name: string
  postalCodePrefixes: string[]
  state: string
  region: string
  active: boolean
}

const CITIES_DATA: City[] = [
  { id: 'berlin', slug: 'berlin', name: 'Berlin', postalCodePrefixes: ['10', '12', '13', '14'], state: 'Berlin', region: 'Ost', active: true },
  { id: 'hamburg', slug: 'hamburg', name: 'Hamburg', postalCodePrefixes: ['20', '21', '22'], state: 'Hamburg', region: 'Nord', active: true },
  { id: 'muenchen', slug: 'muenchen', name: 'München', postalCodePrefixes: ['80', '81'], state: 'Bayern', region: 'Süd', active: true },
  { id: 'koeln', slug: 'koeln', name: 'Köln', postalCodePrefixes: ['50', '51'], state: 'Nordrhein-Westfalen', region: 'West', active: true },
  { id: 'frankfurt-am-main', slug: 'frankfurt-am-main', name: 'Frankfurt am Main', postalCodePrefixes: ['60'], state: 'Hessen', region: 'Mitte', active: true },
  { id: 'stuttgart', slug: 'stuttgart', name: 'Stuttgart', postalCodePrefixes: ['70'], state: 'Baden-Württemberg', region: 'Süd', active: true },
  { id: 'duesseldorf', slug: 'duesseldorf', name: 'Düsseldorf', postalCodePrefixes: ['40'], state: 'Nordrhein-Westfalen', region: 'West', active: true },
  { id: 'leipzig', slug: 'leipzig', name: 'Leipzig', postalCodePrefixes: ['04'], state: 'Sachsen', region: 'Ost', active: true },
  { id: 'dortmund', slug: 'dortmund', name: 'Dortmund', postalCodePrefixes: ['44'], state: 'Nordrhein-Westfalen', region: 'West', active: true },
  { id: 'essen', slug: 'essen', name: 'Essen', postalCodePrefixes: ['45'], state: 'Nordrhein-Westfalen', region: 'West', active: true },
]

export const CITIES: City[] = CITIES_DATA

export function getActiveCities(): City[] {
  return CITIES.filter((c) => c.active)
}

export function getCityBySlug(slug: string): City | undefined {
  return CITIES.find((c) => c.slug === slug && c.active)
}

/** SQL LIKE-Pattern-Präfixe für eine Stadt, zur Verwendung mit `plz LIKE ANY(...)`-artigen Queries. */
export function cityPlzPatterns(city: City): string[] {
  return city.postalCodePrefixes.map((p) => `${p}%`)
}
