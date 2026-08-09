export type Product = {
  id: string
  slug: string
  name: string
  tagline: string
  description: string
  price: number
  compareAtPrice?: number
  costPrice: number
  currency: string
  collection: string
  badge?: string
  features: string[]
  specs: { label: string; value: string }[]
  icon: 'bed' | 'mat' | 'paw' | 'bone' | 'wash'
  color: string
  supplierProductId: string
  supplierVariantId: string
}

export const COLLECTIONS = {
  'hunde-komfort': {
    handle: 'hunde-komfort',
    title: 'Hunde-Komfort',
    description:
      'Orthopädische Betten und Enrichment-Spielzeug für gesündere Gelenke und ausgeglichenere Hunde – für Welpen bis Senioren.',
  },
}

export const PRODUCTS: Product[] = [
  {
    id: 'dc-bed-m',
    slug: 'orthopaedisches-hundebett-memory-schaum-m',
    name: 'Orthopädisches Hundebett Memory-Schaum (M)',
    tagline: 'Entlastet Gelenke, für Hunde bis 15kg',
    description:
      'Formstabiles Memory-Schaum-Bett mit erhöhtem Rand für Geborgenheit. Entlastet Gelenke und Hüfte spürbar – ideal für ältere Hunde, Hunde nach OPs oder empfindliche Rassen. Waschbarer Bezug.',
    price: 49.99,
    compareAtPrice: 69.99,
    costPrice: 13,
    currency: 'EUR',
    collection: 'hunde-komfort',
    badge: 'Bestseller',
    features: [
      'Memory-Schaum passt sich Körper und Gelenken an',
      'Erhöhter Rand gibt Geborgenheit und Kopfstütze',
      'Rutschfester Boden, auch auf Parkett/Fliesen',
      'Bezug abnehmbar und waschbar (30°C)',
      'Ideal für Senioren-Hunde & nach Operationen',
    ],
    specs: [
      { label: 'Maße', value: '60 x 45 x 18cm' },
      { label: 'Geeignet für', value: 'Hunde bis 15kg' },
      { label: 'Material', value: 'Memory-Schaum + Plüsch' },
      { label: 'Pflege', value: 'Bezug waschbar' },
    ],
    icon: 'bed',
    color: '#eee8e0',
    supplierProductId: 'CJ-DC-BED-M',
    supplierVariantId: 'CJ-DC-BED-M-GRY',
  },
  {
    id: 'dc-bed-l',
    slug: 'orthopaedisches-hundebett-memory-schaum-l',
    name: 'Orthopädisches Hundebett Memory-Schaum (L)',
    tagline: 'Entlastet Gelenke, für Hunde bis 35kg',
    description:
      'Die große Version unseres Bestseller-Betts für mittelgroße bis große Hunde. Extra dicker Memory-Schaum-Kern, erhöhter Rand, waschbarer Bezug – spürbare Entlastung für Hüfte, Ellbogen und Wirbelsäule.',
    price: 64.99,
    compareAtPrice: 89.99,
    costPrice: 16,
    currency: 'EUR',
    collection: 'hunde-komfort',
    badge: 'Neu',
    features: [
      'Extra dicker Memory-Schaum-Kern (7cm)',
      'Erhöhter Rand für Rückenlehne & Geborgenheit',
      'Rutschfester, wasserabweisender Boden',
      'Bezug per Reißverschluss abnehmbar, waschbar',
      'Für mittelgroße bis große Hunde bis 35kg',
    ],
    specs: [
      { label: 'Maße', value: '90 x 65 x 20cm' },
      { label: 'Geeignet für', value: 'Hunde bis 35kg' },
      { label: 'Material', value: 'Memory-Schaum + Plüsch' },
      { label: 'Pflege', value: 'Bezug waschbar' },
    ],
    icon: 'bed',
    color: '#e7e2d8',
    supplierProductId: 'CJ-DC-BED-L',
    supplierVariantId: 'CJ-DC-BED-L-BRN',
  },
  {
    id: 'dc-snuffle-01',
    slug: 'schnueffelteppich-snuffle-mat',
    name: 'Schnüffelteppich (Snuffle Mat)',
    tagline: 'Beschäftigung, die auspowert statt nur Gassi',
    description:
      'Versteckt Leckerlis in vielen Stofflagen – dein Hund muss schnüffeln und suchen statt nur zu fressen. Baut Stress ab, beugt Langeweile und Übergewicht vor. Besonders wertvoll für Wohnungshunde und Regentage.',
    price: 24.99,
    compareAtPrice: 34.99,
    costPrice: 5,
    currency: 'EUR',
    collection: 'hunde-komfort',
    features: [
      'Fördert natürliches Schnüffel- & Suchverhalten',
      'Reduziert Stress, Langeweile und zu schnelles Fressen',
      'Waschmaschinenfest',
      'Rutschfester Boden',
      'Für alle Hundegrößen geeignet',
    ],
    specs: [
      { label: 'Maße', value: '40 x 40cm' },
      { label: 'Material', value: 'Fleece + rutschfester Gummiboden' },
      { label: 'Pflege', value: 'Waschmaschinenfest 30°C' },
      { label: 'Schwierigkeit', value: 'Einsteiger bis Fortgeschritten' },
    ],
    icon: 'mat',
    color: '#eaf0e8',
    supplierProductId: 'CJ-DC-SNUF-01',
    supplierVariantId: 'CJ-DC-SNUF-01-GRN',
  },
  {
    id: 'dc-enrich-02',
    slug: 'interaktives-denkspiel-fuer-hunde',
    name: 'Interaktives Denkspiel für Hunde',
    tagline: 'Mentale Auslastung statt nur körperlicher',
    description:
      'Leckerli-Puzzle mit verschiebbaren Elementen, die dein Hund lösen muss. Ideal zur mentalen Auslastung – ein müder Kopf ist oft wirkungsvoller als ein müder Körper. Reduziert Verhaltensprobleme durch Unterforderung.',
    price: 22.99,
    compareAtPrice: 29.99,
    costPrice: 6,
    currency: 'EUR',
    collection: 'hunde-komfort',
    badge: 'Beliebt',
    features: [
      'Mehrere Schwierigkeitsstufen zum Kombinieren',
      'Fördert Problemlösefähigkeit und Konzentration',
      'Rutschfeste Unterseite',
      'Robust und spülmaschinenfest',
      'Beugt Unterforderung & Verhaltensproblemen vor',
    ],
    specs: [
      { label: 'Maße', value: '28 x 28cm' },
      { label: 'Material', value: 'Lebensmittelechter Kunststoff' },
      { label: 'Pflege', value: 'Spülmaschinenfest' },
      { label: 'Schwierigkeit', value: 'Verstellbar' },
    ],
    icon: 'paw',
    color: '#fbeee0',
    supplierProductId: 'CJ-DC-ENRICH-02',
    supplierVariantId: 'CJ-DC-ENRICH-02-STD',
  },
  {
    id: 'dc-treat-03',
    slug: 'leckerli-spender-ball',
    name: 'Leckerli-Spender-Ball',
    tagline: 'Der perfekte Impuls-Zusatzkauf',
    description:
      'Robuster Kau- und Leckerli-Ball, der beim Rollen nach und nach Leckerlis abgibt. Kombiniert Spieltrieb mit Belohnung – ein kleines, günstiges Add-on, das jeder Hundehalter zusätzlich in den Warenkorb legt.',
    price: 14.99,
    compareAtPrice: 19.99,
    costPrice: 4,
    currency: 'EUR',
    collection: 'hunde-komfort',
    features: [
      'Verstellbare Öffnung für Leckerli-Menge',
      'Robustes, kaufestes Material',
      'Fördert Bewegung und Spieltrieb',
      'Leicht zu reinigen',
      'Passt in jede Bestellung als Zusatzkauf',
    ],
    specs: [
      { label: 'Durchmesser', value: '7cm' },
      { label: 'Material', value: 'Naturkautschuk' },
      { label: 'Pflege', value: 'Abwaschbar' },
      { label: 'Geeignet für', value: 'Alle Hundegrößen' },
    ],
    icon: 'bone',
    color: '#f4e8dc',
    supplierProductId: 'CJ-DC-TREAT-03',
    supplierVariantId: 'CJ-DC-TREAT-03-STD',
  },
  {
    id: 'dc-paw-04',
    slug: 'pfotenreiniger-becher',
    name: 'Pfotenreiniger-Becher',
    tagline: 'Saubere Pfoten nach jedem Spaziergang',
    description:
      'Weicher Silikon-Becher zum schnellen Säubern der Pfoten nach dem Gassigehen – kein Dreck mehr im Flur oder auf dem neuen Hundebett. Kleiner Preis, hoher Alltagsnutzen, idealer Zusatzkauf zum Hundebett.',
    price: 12.99,
    compareAtPrice: 17.99,
    costPrice: 4,
    currency: 'EUR',
    collection: 'hunde-komfort',
    features: [
      'Weiche Silikonborsten reinigen sanft',
      'Für 3 Größen: klein, mittel, groß',
      'Schnelle Reinigung ohne volles Bad',
      'Schützt Boden, Sofa und neues Hundebett',
      'Kompakt und leicht mitzunehmen',
    ],
    specs: [
      { label: 'Größen', value: 'S / M / L' },
      { label: 'Material', value: 'Silikon' },
      { label: 'Pflege', value: 'Abwaschbar' },
      { label: 'Geeignet für', value: 'Alle Hundegrößen' },
    ],
    icon: 'wash',
    color: '#e3eef2',
    supplierProductId: 'CJ-DC-PAW-04',
    supplierVariantId: 'CJ-DC-PAW-04-M',
  },
]

export function getProductBySlug(slug: string) {
  return PRODUCTS.find((p) => p.slug === slug)
}

export function getProductsByCollection(handle: string) {
  return PRODUCTS.filter((p) => p.collection === handle)
}
