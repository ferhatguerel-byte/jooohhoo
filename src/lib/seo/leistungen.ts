/**
 * Daten-Modell für gebündelte Leistungen (mehrere Gewerke kombiniert, z.B. eine komplette
 * Badsanierung), im Unterschied zu einzelnen Gewerken (src/lib/seo/gewerke-seo.ts). Trägt
 * /leistungen/[leistung] und /baukosten/[leistung].
 *
 * `hasCostData` ist bewusst `false` für alle Einträge: Es gibt aktuell keine echten,
 * validierten Kostendaten. Solange `hasCostData` false ist, bleibt die zugehörige
 * /baukosten/[leistung]-Seite NOINDEX und zeigt keine Preisspannen (siehe
 * src/app/baukosten/[leistung]/page.tsx) – "keine erfundenen Preiswerte" (Phase-2 §13).
 */
export interface Leistung {
  id: string
  slug: string
  name: string
  shortDescription: string
  longDescription: string
  relatedGewerkSlugs: string[]
  seoTitleTemplate: string
  seoDescriptionTemplate: string
  hasCostData: boolean
  active: boolean
}

const LEISTUNGEN_DATA: Leistung[] = [
  {
    id: 'badsanierung',
    slug: 'badsanierung',
    name: 'Badsanierung',
    shortDescription: 'Komplette oder teilweise Erneuerung eines Badezimmers.',
    longDescription:
      'Eine Badsanierung umfasst typischerweise Sanitär- und Heizungsarbeiten, Fliesenarbeiten, Elektroinstallation und ggf. Trockenbau – meist über mehrere Gewerke koordiniert.',
    relatedGewerkSlugs: ['sanitaer-heizung', 'fliesenleger', 'elektro', 'trockenbau'],
    seoTitleTemplate: 'Badsanierung {stadt} – Fachbetriebe & Kosten | BAUVERSUS',
    seoDescriptionTemplate: 'Badsanierung in {stadt}: passende Fachbetriebe finden, Angebote vergleichen, Auftrag strukturiert vergeben.',
    hasCostData: false,
    active: true,
  },
  {
    id: 'wohnungssanierung',
    slug: 'wohnungssanierung',
    name: 'Wohnungssanierung',
    shortDescription: 'Umfassende Renovierung oder Modernisierung einer Wohnung.',
    longDescription:
      'Eine Wohnungssanierung kombiniert je nach Umfang Maler-, Boden-, Elektro- und Trockenbauarbeiten bis hin zu Sanitär- und Heizungsmodernisierung.',
    relatedGewerkSlugs: ['maler-lackierer', 'bodenleger', 'elektro', 'trockenbau'],
    seoTitleTemplate: 'Wohnungssanierung {stadt} – Fachbetriebe & Kosten | BAUVERSUS',
    seoDescriptionTemplate: 'Wohnungssanierung in {stadt}: passende Fachbetriebe finden, Angebote vergleichen, Auftrag strukturiert vergeben.',
    hasCostData: false,
    active: true,
  },
  {
    id: 'altbausanierung',
    slug: 'altbausanierung',
    name: 'Altbausanierung',
    shortDescription: 'Sanierung und Modernisierung von Altbauten.',
    longDescription:
      'Altbausanierung reicht von energetischer Sanierung (Fassade, Dach) über Elektro- und Sanitärmodernisierung bis zu statischen Eingriffen im Rohbau.',
    relatedGewerkSlugs: ['fassade', 'dachdecker', 'elektro', 'sanitaer-heizung', 'rohbau'],
    seoTitleTemplate: 'Altbausanierung {stadt} – Fachbetriebe & Kosten | BAUVERSUS',
    seoDescriptionTemplate: 'Altbausanierung in {stadt}: passende Fachbetriebe finden, Angebote vergleichen, Auftrag strukturiert vergeben.',
    hasCostData: false,
    active: true,
  },
]

export const LEISTUNGEN: Leistung[] = LEISTUNGEN_DATA

export function getActiveLeistungen(): Leistung[] {
  return LEISTUNGEN.filter((l) => l.active)
}

export function getLeistungBySlug(slug: string): Leistung | undefined {
  return LEISTUNGEN.find((l) => l.slug === slug && l.active)
}
