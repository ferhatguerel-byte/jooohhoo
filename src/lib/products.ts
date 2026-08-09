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
  icon: 'bed' | 'mat' | 'paw' | 'bone' | 'bag'
  color: string
  supplierProductId: string
  supplierVariantId: string
  cjMatch: string
}

export const COLLECTIONS = {
  'hunde-komfort': {
    handle: 'hunde-komfort',
    title: 'Hunde-Komfort',
    description:
      'Kuschelige Betten und Enrichment-Spielzeug für ausgeglichenere, gesündere Hunde – für Welpen bis Senioren.',
  },
}

// Preise/Bestellzahlen ("cjMatch") stammen aus CJ-Dropshipping-Suchergebnis-Screenshots.
// supplierProductId/supplierVariantId sind noch Platzhalter — die echte SKU/PID steht erst
// auf der jeweiligen CJ-Produktdetailseite (nicht im Such-Grid) und muss dort übernommen werden.
export const PRODUCTS: Product[] = [
  {
    id: 'dc-bed-m',
    slug: 'hundebett-haustiernest-m',
    name: 'Hundebett Haustiernest (M)',
    tagline: 'Kuscheliges Rückzugsbett für Hunde bis 15kg',
    description:
      'Weiches, umschließendes Nest-Bett mit erhöhtem Rand für Geborgenheit und Wärme. Reduziert nachweislich Unruhe bei ängstlichen oder gestressten Hunden – ideal als Rückzugsort im Wohnzimmer oder Schlafzimmer.',
    price: 44.99,
    compareAtPrice: 64.99,
    costPrice: 9,
    currency: 'EUR',
    collection: 'hunde-komfort',
    badge: 'Bestseller',
    features: [
      'Nest-Form mit erhöhtem Rand für Geborgenheit',
      'Weiches Plüsch-Material, wärmt im Winter',
      'Rutschfester Boden, auch auf Parkett/Fliesen',
      'Bezug abnehmbar und waschbar',
      'Beliebt bei ängstlichen & gestressten Hunden',
    ],
    specs: [
      { label: 'Maße', value: '55 x 45 x 18cm' },
      { label: 'Geeignet für', value: 'Hunde bis 15kg' },
      { label: 'Material', value: 'Plüsch + Füllung' },
      { label: 'Pflege', value: 'Bezug waschbar' },
    ],
    icon: 'bed',
    color: '#eee8e0',
    supplierProductId: 'CJ-PENDING-BED-M',
    supplierVariantId: 'CJ-PENDING-BED-M',
    cjMatch: 'Hundebett, Haustiernest, Katzenmatte — 3,10–20,56€, 795 Bestellungen',
  },
  {
    id: 'dc-bed-l',
    slug: 'hundebett-haustiernest-l',
    name: 'Hundebett Haustiernest (L)',
    tagline: 'Kuscheliges Rückzugsbett für Hunde bis 35kg',
    description:
      'Die große Version unseres Bestseller-Nestbetts für mittelgroße bis große Hunde. Extra viel Füllung, erhöhter Rand rundherum, waschbarer Bezug – ein echter Rückzugsort statt nur eine Unterlage.',
    price: 59.99,
    compareAtPrice: 84.99,
    costPrice: 15,
    currency: 'EUR',
    collection: 'hunde-komfort',
    badge: 'Neu',
    features: [
      'Extra große Nest-Form für mittelgroße/große Hunde',
      'Dicke Füllung, erhöhter Rand als Kopfstütze',
      'Rutschfester, robuster Boden',
      'Bezug abnehmbar, waschbar',
      'Für mittelgroße bis große Hunde bis 35kg',
    ],
    specs: [
      { label: 'Maße', value: '80 x 65 x 20cm' },
      { label: 'Geeignet für', value: 'Hunde bis 35kg' },
      { label: 'Material', value: 'Plüsch + Füllung' },
      { label: 'Pflege', value: 'Bezug waschbar' },
    ],
    icon: 'bed',
    color: '#e7e2d8',
    supplierProductId: 'CJ-PENDING-BED-L',
    supplierVariantId: 'CJ-PENDING-BED-L',
    cjMatch: 'Hundebett, Haustiernest, Katzenmatte (größere Variante) — 3,10–20,56€, 795 Bestellungen',
  },
  {
    id: 'dc-snuffle-01',
    slug: 'hundeschnueffelkissen',
    name: 'Hundeschnüffelkissen',
    tagline: 'Beschäftigung, die auspowert statt nur Gassi',
    description:
      'Versteckt Leckerlis in vielen Stofflagen – dein Hund muss schnüffeln und suchen statt nur zu fressen. Baut Stress ab, beugt Langeweile und zu schnellem Fressen vor. Besonders wertvoll für Wohnungshunde und Regentage.',
    price: 24.99,
    compareAtPrice: 34.99,
    costPrice: 4.49,
    currency: 'EUR',
    collection: 'hunde-komfort',
    features: [
      'Fördert natürliches Schnüffel- & Suchverhalten',
      'Reduziert Stress, Langeweile und zu schnelles Fressen',
      'Waschbar',
      'Rutschfester Boden',
      'Für alle Hundegrößen geeignet',
    ],
    specs: [
      { label: 'Maße', value: '40 x 40cm' },
      { label: 'Material', value: 'Fleece + rutschfester Boden' },
      { label: 'Pflege', value: 'Waschbar' },
      { label: 'Schwierigkeit', value: 'Einsteiger bis Fortgeschritten' },
    ],
    icon: 'mat',
    color: '#eaf0e8',
    supplierProductId: 'CJ-PENDING-SNUFFLE',
    supplierVariantId: 'CJ-PENDING-SNUFFLE',
    cjMatch: 'Hundeschnüffelkissen, Hundespielzeug, Hundetraining — 4,49€, 630 Bestellungen',
  },
  {
    id: 'dc-enrich-02',
    slug: 'interaktiver-futterpuzzle-spender',
    name: 'Interaktiver Futterpuzzle-Spender',
    tagline: 'Mentale Auslastung statt nur körperlicher',
    description:
      'Leckerli-Spender-Puzzle, das dein Hund knacken muss, um an die Belohnung zu kommen. Ideal zur mentalen Auslastung – ein müder Kopf ist oft wirkungsvoller als ein müder Körper. Reduziert Verhaltensprobleme durch Unterforderung.',
    price: 24.99,
    compareAtPrice: 32.99,
    costPrice: 7,
    currency: 'EUR',
    collection: 'hunde-komfort',
    badge: 'Beliebt',
    features: [
      'Fördert Problemlösefähigkeit und Konzentration',
      'Verstellbare Schwierigkeit',
      'Rutschfeste Unterseite',
      'Robust und leicht zu reinigen',
      'Beugt Unterforderung & Verhaltensproblemen vor',
    ],
    specs: [
      { label: 'Maße', value: '28 x 28cm' },
      { label: 'Material', value: 'Lebensmittelechter Kunststoff' },
      { label: 'Pflege', value: 'Abwaschbar' },
      { label: 'Schwierigkeit', value: 'Verstellbar' },
    ],
    icon: 'paw',
    color: '#fbeee0',
    supplierProductId: 'CJ-PENDING-PUZZLE',
    supplierVariantId: 'CJ-PENDING-PUZZLE',
    cjMatch: 'Interaktiver Futterpuzzle-Spender für Hunde — 4,88–9,76€, 659 Bestellungen',
  },
  {
    id: 'dc-treat-03',
    slug: 'automatischer-leckerli-ball',
    name: 'Automatischer Leckerli-Ball',
    tagline: 'Der meistbestellte Zusatzkauf in dieser Nische',
    description:
      'Hüpfender, rollender Ball, der beim Spielen nach und nach Leckerlis abgibt. Kombiniert Spieltrieb mit Belohnung – ein kleines, günstiges Add-on, das praktisch jeder Hundehalter zusätzlich in den Warenkorb legt.',
    price: 12.99,
    compareAtPrice: 17.99,
    costPrice: 2,
    currency: 'EUR',
    collection: 'hunde-komfort',
    badge: 'Meistbestellt',
    features: [
      'Gibt beim Rollen automatisch Leckerlis ab',
      'Robustes, kaufestes Material',
      'Fördert Bewegung und Spieltrieb',
      'Leicht zu reinigen',
      'Passt in jede Bestellung als Zusatzkauf',
    ],
    specs: [
      { label: 'Durchmesser', value: '7cm' },
      { label: 'Material', value: 'Kunststoff/Gummi' },
      { label: 'Pflege', value: 'Abwaschbar' },
      { label: 'Geeignet für', value: 'Alle Hundegrößen' },
    ],
    icon: 'bone',
    color: '#f4e8dc',
    supplierProductId: 'CJ-PENDING-TREATBALL',
    supplierVariantId: 'CJ-PENDING-TREATBALL',
    cjMatch: 'Automatischer, hüpfender und rollender Ball — 0,81–3,34€, 2021 Bestellungen',
  },
  {
    id: 'dc-bags-04',
    slug: 'hundekotbeutel-vorteilspack',
    name: 'Hundekotbeutel Vorteilspack (750 Stück)',
    tagline: 'Der Verbrauchsartikel, den jeder nachkauft',
    description:
      'Reißfeste, blickdichte Kotbeutel im Großpack – reicht für Monate. Der ideale Zusatzkauf zum Hundebett: niedriger Preis pro Nutzen, garantierter Wiederkauf, passt in jede Bestellung.',
    price: 24.99,
    compareAtPrice: 32.99,
    costPrice: 11.52,
    currency: 'EUR',
    collection: 'hunde-komfort',
    features: [
      '750 Stück im Vorteilspack – reicht für Monate',
      'Reißfest und blickdicht',
      'Kompakte Rollen, passen in jede Tasche',
      'Umweltfreundlicheres PE-Material',
      'Klassischer Wiederkauf-Artikel',
    ],
    specs: [
      { label: 'Menge', value: '750 Stück' },
      { label: 'Maße', value: '30 x 20cm' },
      { label: 'Material', value: 'PE' },
      { label: 'Farbe', value: 'Schwarz' },
    ],
    icon: 'bag',
    color: '#e3eef2',
    supplierProductId: '1990691848111837185',
    supplierVariantId: 'CJ-PENDING-BAGS-VID',
    cjMatch: 'Hundekotbeutel, 750 Stück, Schwarz, 30 x 20cm, PE — 11,52€, 76 Bestellungen — https://www.cjdropshipping.com/product/--dog-poop-bags-750-pcs.-black-30x20-cm-pe-p-1990691848111837185.html',
  },
]

export function getProductBySlug(slug: string) {
  return PRODUCTS.find((p) => p.slug === slug)
}

export function getProductsByCollection(handle: string) {
  return PRODUCTS.filter((p) => p.collection === handle)
}
