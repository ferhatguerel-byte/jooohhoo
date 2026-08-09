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
    slug: 'hundebett-gepolstertes-kissen-m',
    name: 'Hundebett mit gepolstertem Kissen (M)',
    tagline: 'Kuscheliges Rückzugsbett für Hunde bis 15kg',
    description:
      'Weiches, gepolstertes Hundebett mit erhöhtem Rand für Geborgenheit und Wärme. Ein fester Rückzugsort tut vielen Hunden sichtbar gut – ideal im Wohnzimmer oder Schlafzimmer.',
    price: 44.99,
    compareAtPrice: 64.99,
    costPrice: 21.35,
    currency: 'EUR',
    collection: 'hunde-komfort',
    badge: 'Bestseller',
    features: [
      'Gepolstertes Kissen mit erhöhtem Rand für Geborgenheit',
      'Weiches Material, wärmt im Winter',
      'Rutschfester Boden, auch auf Parkett/Fliesen',
      'Bezug abnehmbar und waschbar',
      'Beliebter Rückzugsort für zuhause',
    ],
    specs: [
      { label: 'Größe', value: 'M' },
      { label: 'Geeignet für', value: 'Hunde bis 15kg' },
      { label: 'Material', value: 'Plüsch + Füllung' },
      { label: 'Pflege', value: 'Bezug waschbar' },
    ],
    icon: 'bed',
    color: '#eee8e0',
    supplierProductId: '1990440375108673538',
    supplierVariantId: 'CJ-PENDING-BED-M-VID',
    cjMatch:
      'Dog Bed with Padded Cushion, Size M — 21,35–46,96€, 13 Bestellungen — https://www.cjdropshipping.com/product/--dog-bed-with-padded-cushion-size-m---p-1990440375108673538.html',
  },
  {
    id: 'dc-bed-l',
    slug: 'hundebett-gepolstertes-kissen-l',
    name: 'Hundebett mit gepolstertem Kissen (L)',
    tagline: 'Kuscheliges Rückzugsbett für Hunde bis 35kg',
    description:
      'Die große Größenvariante desselben gepolsterten Hundebetts, für mittelgroße bis große Hunde. Erhöhter Rand rundherum, waschbarer Bezug – ein echter Rückzugsort statt nur eine Unterlage.',
    price: 59.99,
    compareAtPrice: 84.99,
    costPrice: 46.96,
    currency: 'EUR',
    collection: 'hunde-komfort',
    badge: 'Neu',
    features: [
      'Größere Variante desselben Bestseller-Betts',
      'Dicke Polsterung, erhöhter Rand als Kopfstütze',
      'Rutschfester, robuster Boden',
      'Bezug abnehmbar, waschbar',
      'Für mittelgroße bis große Hunde bis 35kg',
    ],
    specs: [
      { label: 'Größe', value: 'L' },
      { label: 'Geeignet für', value: 'Hunde bis 35kg' },
      { label: 'Material', value: 'Plüsch + Füllung' },
      { label: 'Pflege', value: 'Bezug waschbar' },
    ],
    icon: 'bed',
    color: '#e7e2d8',
    supplierProductId: '1990440375108673538',
    supplierVariantId: 'CJ-PENDING-BED-L-VID',
    cjMatch:
      'Dog Bed with Padded Cushion, größere Größenvariante desselben Produkts — 21,35–46,96€ (Preis variiert nach Größe), 13 Bestellungen — https://www.cjdropshipping.com/product/--dog-bed-with-padded-cushion-size-m---p-1990440375108673538.html',
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
    supplierProductId: '1441373809616752640',
    supplierVariantId: 'CJ-PENDING-SNUFFLE-VID',
    cjMatch:
      'Dog Sniffing Training Blanket / Snuffle Ball Mat, detachable pads — 4,49€, 630 Bestellungen — https://www.cjdropshipping.com/product/dog-sniffing-training-blanket-snuffle-ball-mat-detachable-pads-puzzle-toy-pet-supplies-for-dogs-cats-p-1441373809616752640.html',
  },
  {
    id: 'dc-enrich-02',
    slug: 'interaktiver-futterpuzzle-spender-ente',
    name: 'Interaktiver Futterpuzzle-Spender (Enten-Design)',
    tagline: 'Mentale Auslastung statt nur körperlicher',
    description:
      'Leckerli-Spender-Puzzle im verspielten Enten-Design, das dein Hund knacken muss, um an die Belohnung zu kommen. Ideal zur mentalen Auslastung – ein müder Kopf ist oft wirkungsvoller als ein müder Körper. Rutschfester Boden, reduziert Verhaltensprobleme durch Unterforderung.',
    price: 24.99,
    compareAtPrice: 32.99,
    costPrice: 7,
    currency: 'EUR',
    collection: 'hunde-komfort',
    badge: 'Beliebt',
    features: [
      'Fördert Problemlösefähigkeit und Konzentration',
      'Verspieltes Enten-Design',
      'Rutschfeste Unterseite',
      'Robust und leicht zu reinigen',
      'Beugt Unterforderung & Verhaltensproblemen vor',
    ],
    specs: [
      { label: 'Design', value: 'Cartoon-Ente' },
      { label: 'Material', value: 'Lebensmittelechter Kunststoff' },
      { label: 'Pflege', value: 'Abwaschbar' },
      { label: 'Boden', value: 'Rutschfest' },
    ],
    icon: 'paw',
    color: '#fbeee0',
    supplierProductId: '2502181058121618100',
    supplierVariantId: 'CJ-PENDING-PUZZLE-VID',
    cjMatch:
      'Dog Puzzle Feeder Interactive Pet Food Treat Dispenser, Cartoon Duck Design, Anti-Slip — https://www.cjdropshipping.com/product/dog-puzzle-feeder-interactive-pet-food-treat-dispenser-cartoon-duck-design-anti-slip-pets-automatic-feeder-toys-for-dog-training-pet-products-p-2502181058121618100.html',
  },
  {
    id: 'dc-treat-03',
    slug: 'automatischer-bewegungsball',
    name: 'Automatischer Bewegungsball',
    tagline: 'Der meistbestellte Zusatzkauf in dieser Nische',
    description:
      'Selbstfahrender, hüpfender Ball, der bei Bewegung/Berührung automatisch die Richtung wechselt – weckt den Spieltrieb und sorgt für Beschäftigung, auch wenn du gerade keine Zeit hast. Ursprünglich als Katzenspielzeug entwickelt, bei kleinen und verspielten Hunden ebenso beliebt.',
    price: 12.99,
    compareAtPrice: 17.99,
    costPrice: 2,
    currency: 'EUR',
    collection: 'hunde-komfort',
    badge: 'Meistbestellt',
    features: [
      'Bewegt sich automatisch, weckt den Spieltrieb',
      'Robustes Material',
      'Fördert Bewegung und Beschäftigung',
      'Leicht zu reinigen',
      'Passt in jede Bestellung als Zusatzkauf',
    ],
    specs: [
      { label: 'Durchmesser', value: '7cm' },
      { label: 'Material', value: 'Kunststoff/Gummi' },
      { label: 'Pflege', value: 'Abwaschbar' },
      { label: 'Geeignet für', value: 'Kleine bis mittelgroße, verspielte Hunde' },
    ],
    icon: 'bone',
    color: '#f4e8dc',
    supplierProductId: '1734817917113479168',
    supplierVariantId: 'CJ-PENDING-BALL-VID',
    cjMatch:
      'Automatic Moving Bouncing Rolling Ball (ursprünglich Katzenspielzeug) — 0,81–3,34€, 2021 Bestellungen — https://www.cjdropshipping.com/product/automatic-moving-bouncing-rolling-ball-smart-cat-toy-ball-self-moving-kitten-toy-for-indoor-cat-kitten-p-1734817917113479168.html',
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
