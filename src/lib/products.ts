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
  icon: 'lamp' | 'sun' | 'leaf' | 'clip' | 'panel'
  color: string
  supplierProductId: string
  supplierVariantId: string
}

export const COLLECTIONS = {
  'grow-lights': {
    handle: 'grow-lights',
    title: 'Pflanzenlampen',
    description:
      'Vollspektrum-Grow-Lights für gesunde Zimmerpflanzen das ganze Jahr über – auch ohne Südfenster.',
  },
}

export const PRODUCTS: Product[] = [
  {
    id: 'gl-clip-01',
    slug: 'clip-vollspektrum-pflanzenlampe',
    name: 'Clip-On Vollspektrum-Pflanzenlampe',
    tagline: 'Klemmt an jedes Regal, jeden Schreibtisch',
    description:
      'Flexible Klemmleuchte mit Vollspektrum-LEDs (rot/blau/weiß), 3 Lichtmodi und Timer-Funktion. Ideal für einzelne Zimmerpflanzen auf Schreibtisch, Regal oder Fensterbank ohne ausreichend Tageslicht.',
    price: 39.99,
    compareAtPrice: 59.99,
    costPrice: 9.5,
    currency: 'EUR',
    collection: 'grow-lights',
    badge: 'Bestseller',
    features: [
      'Vollspektrum LED (rot/blau/weiß) für alle Wachstumsphasen',
      'Timer: 4h / 8h / 12h automatische Abschaltung',
      '3 Helligkeitsstufen, dimmbar',
      'Flexibler Schwanenhals, 360° schwenkbar',
      'Geräuschlos, geringer Stromverbrauch (12W)',
    ],
    specs: [
      { label: 'Leistung', value: '12W' },
      { label: 'Lichtfarbe', value: 'Vollspektrum (380–800nm)' },
      { label: 'Kabellänge', value: '1.5m' },
      { label: 'Material', value: 'ABS + Aluminium' },
    ],
    icon: 'clip',
    color: '#e8f0e6',
    supplierProductId: 'CJ-GL-CLIP-01',
    supplierVariantId: 'CJ-GL-CLIP-01-BLK',
  },
  {
    id: 'gl-stand-02',
    slug: 'stehlampe-pflanzenlicht-hoehenverstellbar',
    name: 'Höhenverstellbare Pflanzen-Stehlampe',
    tagline: 'Für größere Pflanzen und ganze Pflanzengruppen',
    description:
      'Standleuchte mit verstellbarer Höhe (30–150cm) und schwenkbarem Kopf. Beleuchtet mehrere Pflanzen gleichzeitig und passt sich dem Wachstum an – perfekt für Monstera, Ficus oder ganze Pflanzenecken.',
    price: 64.99,
    compareAtPrice: 89.99,
    costPrice: 17,
    currency: 'EUR',
    collection: 'grow-lights',
    badge: 'Neu',
    features: [
      'Höhenverstellbar von 30cm bis 150cm',
      'Schwenkbarer Lampenkopf, deckt große Pflanzen ab',
      'Standfuß mit Gewicht für sicheren Stand',
      'Fernbedienung mit Timer & Dimmer',
      'Für bis zu 3 mittelgroße Pflanzen geeignet',
    ],
    specs: [
      { label: 'Leistung', value: '24W' },
      { label: 'Höhe', value: '30–150cm' },
      { label: 'Steuerung', value: 'Fernbedienung' },
      { label: 'Material', value: 'Metall + ABS' },
    ],
    icon: 'lamp',
    color: '#eef2f7',
    supplierProductId: 'CJ-GL-STAND-02',
    supplierVariantId: 'CJ-GL-STAND-02-WHT',
  },
  {
    id: 'gl-panel-03',
    slug: 'led-panel-pflanzenregal',
    name: 'LED-Panel für Pflanzenregale',
    tagline: 'Gleichmäßiges Licht für mehrere Etagen',
    description:
      'Flaches LED-Panel zum Aufhängen über Regalböden oder Zimmerpflanzen-Regalen. Gleichmäßige Ausleuchtung ohne Schatten, ideal für Sukkulenten- und Kräutersammlungen.',
    price: 49.99,
    compareAtPrice: 69.99,
    costPrice: 12.5,
    currency: 'EUR',
    collection: 'grow-lights',
    features: [
      'Gleichmäßige Flächenbeleuchtung ohne Schatten',
      'Inkl. Aufhänge-Set für Regalböden',
      'Dimmbar in 5 Stufen',
      'Ultraflaches Design (2cm)',
      'Deckt Fläche bis 40x30cm ab',
    ],
    specs: [
      { label: 'Leistung', value: '18W' },
      { label: 'Fläche', value: 'bis 40x30cm' },
      { label: 'Bauhöhe', value: '2cm' },
      { label: 'Material', value: 'Aluminium' },
    ],
    icon: 'panel',
    color: '#f4efe8',
    supplierProductId: 'CJ-GL-PANEL-03',
    supplierVariantId: 'CJ-GL-PANEL-03-STD',
  },
  {
    id: 'gl-sun-04',
    slug: 'sonnenimitation-pflanzenlampe',
    name: 'Sonnenimitations-Pflanzenlampe',
    tagline: 'Natürliches Tageslicht-Spektrum',
    description:
      'Simuliert den natürlichen Tagesverlauf der Sonne mit warmweißem Licht (3000K). Reduziert Stress bei lichthungrigen Pflanzen wie Orchideen und Kräutern spürbar.',
    price: 54.99,
    compareAtPrice: 74.99,
    costPrice: 14,
    currency: 'EUR',
    collection: 'grow-lights',
    features: [
      'Natürliches Sonnenlicht-Spektrum (3000K)',
      'Sanfter Sonnenauf-/-untergangs-Modus',
      'Standfuß + Klemmhalterung im Set',
      'Touch-Bedienung',
      'Ideal für Orchideen & Kräuter',
    ],
    specs: [
      { label: 'Leistung', value: '15W' },
      { label: 'Farbtemperatur', value: '3000K' },
      { label: 'Bedienung', value: 'Touch' },
      { label: 'Material', value: 'ABS' },
    ],
    icon: 'sun',
    color: '#f8f1e4',
    supplierProductId: 'CJ-GL-SUN-04',
    supplierVariantId: 'CJ-GL-SUN-04-STD',
  },
  {
    id: 'gl-mini-05',
    slug: 'mini-pflanzenlampe-fensterbank',
    name: 'Mini-Pflanzenlampe für die Fensterbank',
    tagline: 'Kompakter Einstieg für 1–2 Pflanzen',
    description:
      'Kompakte USB-Pflanzenlampe für die Fensterbank oder das Homeoffice. Klein, aber mit vollem Spektrum – der ideale Einstieg in bessere Pflanzenpflege.',
    price: 24.99,
    compareAtPrice: 34.99,
    costPrice: 6,
    currency: 'EUR',
    collection: 'grow-lights',
    badge: 'Einsteiger',
    features: [
      'USB-betrieben, überall einsetzbar',
      'Vollspektrum auf kleinstem Raum',
      'Integrierter Timer',
      'Leichtes, kompaktes Design',
      'Für 1–2 kleine Pflanzen',
    ],
    specs: [
      { label: 'Leistung', value: '6W' },
      { label: 'Stromquelle', value: 'USB (5V)' },
      { label: 'Gewicht', value: '180g' },
      { label: 'Material', value: 'ABS' },
    ],
    icon: 'leaf',
    color: '#eaf3ea',
    supplierProductId: 'CJ-GL-MINI-05',
    supplierVariantId: 'CJ-GL-MINI-05-STD',
  },
]

export function getProductBySlug(slug: string) {
  return PRODUCTS.find((p) => p.slug === slug)
}

export function getProductsByCollection(handle: string) {
  return PRODUCTS.filter((p) => p.collection === handle)
}
