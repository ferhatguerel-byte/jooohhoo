import { GEWERKE, type Gewerk } from '@/lib/gewerke'
import { slugify } from '@/lib/slugify'

/**
 * SEO-Metadaten für Gewerke, für die programmatische Landingpages (/handwerker/[gewerk],
 * /handwerker/[gewerk]/[stadt], /nachunternehmer/...) gebaut werden.
 *
 * Bewusst nur eine kuratierte Teilmenge der bestehenden GEWERKE-Liste (src/lib/gewerke.ts),
 * nicht alle 24 Einträge und nicht die vollständige Beispielliste aus der Phase-2-Vorgabe:
 * "Nicht blind alle Daten einfügen, wenn sie nicht sinnvoll zur bestehenden Architektur
 * passen." Reine Dienstleistungen ohne baulichen SEO-Suchintent (Umzug, Winterdienst,
 * Schädlingsbekämpfung, Schlüsseldienst, Gebäude-/Fensterreinigung) sind hier bewusst
 * ausgeklammert. `active: false` erzeugt keine Landingpage, ist aber Teil des Datenmodells.
 */
export interface GewerkSeo {
  id: string
  slug: string
  name: Gewerk
  shortDescription: string
  longDescription: string
  category: string
  parentCategory: string
  relatedServices: string[]
  seoTitleTemplate: string
  seoDescriptionTemplate: string
  active: boolean
}

function titleTemplate(name: string): string {
  return `${name} in {stadt} – Fachbetriebe & Angebote vergleichen | BAUVERSUS`
}

function descriptionTemplate(name: string): string {
  return `${name}-Fachbetriebe in {stadt} finden, Angebote vergleichen und Auftrag über BAUVERSUS vergeben. Geprüfte Betriebe, strukturierte Anfragen, keine Vermittlungsgebühr für Auftraggeber.`
}

const GEWERKE_SEO_DATA: GewerkSeo[] = [
  {
    id: 'trockenbau',
    slug: 'trockenbau',
    name: 'Trockenbau',
    shortDescription: 'Trennwände, abgehängte Decken und Dachausbau in Trockenbauweise.',
    longDescription:
      'Trockenbau umfasst den Innenausbau mit Gipskarton- und Ständerwerk-Konstruktionen: Trennwände, abgehängte Decken, Dachschrägenverkleidung und Vorsatzschalen. Ein zentrales Gewerk bei Renovierungen, Dachgeschossausbau und Gewerbeausbau.',
    category: 'Innenausbau',
    parentCategory: 'Bau & Handwerk',
    relatedServices: ['maler-lackierer', 'bodenleger', 'elektro'],
    seoTitleTemplate: titleTemplate('Trockenbau'),
    seoDescriptionTemplate: descriptionTemplate('Trockenbau'),
    active: true,
  },
  {
    id: 'maler-lackierer',
    slug: 'maler-lackierer',
    name: 'Maler & Lackierer',
    shortDescription: 'Wand- und Deckenanstriche, Tapezierarbeiten, Lackierarbeiten innen und außen.',
    longDescription:
      'Maler- und Lackierbetriebe übernehmen Anstriche, Tapezierarbeiten, Lasuren und Lackierungen an Wänden, Decken, Holz- und Metallbauteilen – von der Einzelrenovierung bis zur Fassadenbeschichtung.',
    category: 'Innenausbau',
    parentCategory: 'Bau & Handwerk',
    relatedServices: ['trockenbau', 'fassade', 'bodenleger'],
    seoTitleTemplate: titleTemplate('Maler'),
    seoDescriptionTemplate: descriptionTemplate('Maler'),
    active: true,
  },
  {
    id: 'elektro',
    slug: 'elektro',
    name: 'Elektro',
    shortDescription: 'Elektroinstallation, Verteilerbau, Smart Home, Photovoltaik-Anschluss.',
    longDescription:
      'Elektrofachbetriebe planen und installieren Stromkreise, Verteilerschränke, Beleuchtung, Smart-Home-Systeme und den elektrischen Anschluss von Photovoltaik- und Wallbox-Anlagen. Meisterpflichtiges Gewerk – auf BAUVERSUS nur mit verifiziertem Qualifikationsnachweis aktiv.',
    category: 'Technik',
    parentCategory: 'Bau & Handwerk',
    relatedServices: ['sanitaer-heizung'],
    seoTitleTemplate: titleTemplate('Elektriker'),
    seoDescriptionTemplate: descriptionTemplate('Elektro'),
    active: true,
  },
  {
    id: 'sanitaer-heizung',
    slug: 'sanitaer-heizung',
    name: 'Sanitär & Heizung',
    shortDescription: 'Bad- und Heizungsinstallation, Rohrleitungen, Wärmepumpen-Anbindung.',
    longDescription:
      'SHK-Betriebe installieren und warten Sanitäranlagen, Heizsysteme und Rohrleitungen – von der Badsanierung bis zum Heizungstausch. Meisterpflichtiges Gewerk – auf BAUVERSUS nur mit verifiziertem Qualifikationsnachweis aktiv.',
    category: 'Technik',
    parentCategory: 'Bau & Handwerk',
    relatedServices: ['elektro', 'fliesenleger'],
    seoTitleTemplate: titleTemplate('Sanitär- & Heizungsbetriebe'),
    seoDescriptionTemplate: descriptionTemplate('Sanitär- und Heizungs'),
    active: true,
  },
  {
    id: 'fliesenleger',
    slug: 'fliesenleger',
    name: 'Fliesenleger',
    shortDescription: 'Verlegung von Fliesen und Naturstein in Bad, Küche und Wohnraum.',
    longDescription:
      'Fliesenlegebetriebe verlegen Fliesen, Feinsteinzeug und Naturstein in Bädern, Küchen und Wohnräumen, inklusive Abdichtung und Untergrundvorbereitung.',
    category: 'Innenausbau',
    parentCategory: 'Bau & Handwerk',
    relatedServices: ['sanitaer-heizung', 'bodenleger'],
    seoTitleTemplate: titleTemplate('Fliesenleger'),
    seoDescriptionTemplate: descriptionTemplate('Fliesenleger'),
    active: true,
  },
  {
    id: 'bodenleger',
    slug: 'bodenleger',
    name: 'Bodenleger',
    shortDescription: 'Verlegung von Parkett, Laminat, Vinyl und textilen Bodenbelägen.',
    longDescription:
      'Bodenlegebetriebe verlegen Parkett, Laminat, Vinyl- und textile Bodenbeläge inklusive Untergrundvorbereitung und Sockelleisten.',
    category: 'Innenausbau',
    parentCategory: 'Bau & Handwerk',
    relatedServices: ['trockenbau', 'fliesenleger'],
    seoTitleTemplate: titleTemplate('Bodenleger'),
    seoDescriptionTemplate: descriptionTemplate('Bodenleger'),
    active: true,
  },
  {
    id: 'dachdecker',
    slug: 'dachdecker',
    name: 'Dachdecker',
    shortDescription: 'Dachdeckung, Dachsanierung, Dämmung und Dachentwässerung.',
    longDescription:
      'Dachdeckerbetriebe übernehmen Neueindeckung, Dachsanierung, Wärmedämmung und Dachentwässerung – von der Reparatur bis zur kompletten Dachsanierung.',
    category: 'Gebäudehülle',
    parentCategory: 'Bau & Handwerk',
    relatedServices: ['fassade'],
    seoTitleTemplate: titleTemplate('Dachdecker'),
    seoDescriptionTemplate: descriptionTemplate('Dachdecker'),
    active: true,
  },
  {
    id: 'fassade',
    slug: 'fassade',
    name: 'Fassade',
    shortDescription: 'Fassadendämmung, WDVS, Putz- und Beschichtungsarbeiten.',
    longDescription:
      'Fassadenbetriebe übernehmen Wärmedämmverbundsysteme (WDVS), Putzarbeiten und Fassadenbeschichtungen zur energetischen Sanierung und Instandsetzung von Gebäudehüllen.',
    category: 'Gebäudehülle',
    parentCategory: 'Bau & Handwerk',
    relatedServices: ['dachdecker', 'maler-lackierer'],
    seoTitleTemplate: titleTemplate('Fassadenbetriebe'),
    seoDescriptionTemplate: descriptionTemplate('Fassaden'),
    active: true,
  },
  {
    id: 'rohbau',
    slug: 'rohbau',
    name: 'Rohbau',
    shortDescription: 'Mauerwerk, Beton- und Stahlbetonarbeiten für Neubau und Anbau.',
    longDescription:
      'Rohbaubetriebe erstellen Mauerwerk, Beton- und Stahlbetonkonstruktionen für Neubauten, Anbauten und größere bauliche Erweiterungen.',
    category: 'Rohbau & Konstruktion',
    parentCategory: 'Bau & Handwerk',
    relatedServices: ['dachdecker', 'fassade'],
    seoTitleTemplate: titleTemplate('Rohbaubetriebe'),
    seoDescriptionTemplate: descriptionTemplate('Rohbau'),
    active: true,
  },
  {
    id: 'tischler-schreiner',
    slug: 'tischler-schreiner',
    name: 'Tischler & Schreiner',
    shortDescription: 'Möbel- und Innenausbau, Türen, Einbauschränke, Holzarbeiten nach Maß.',
    longDescription:
      'Tischler- und Schreinerbetriebe fertigen Möbel, Einbauschränke, Türen und Holzkonstruktionen nach Maß – für Innenausbau, Renovierung und Neubau.',
    category: 'Innenausbau',
    parentCategory: 'Bau & Handwerk',
    relatedServices: ['trockenbau', 'bodenleger'],
    seoTitleTemplate: titleTemplate('Tischler & Schreiner'),
    seoDescriptionTemplate: descriptionTemplate('Tischler- und Schreiner'),
    active: true,
  },
]

// Absicherung: nur Gewerke aufnehmen, die tatsächlich in der Plattform-Gewerkeliste existieren.
const VALID_NAMES = new Set<string>(GEWERKE)
export const GEWERKE_SEO: GewerkSeo[] = GEWERKE_SEO_DATA.filter((g) => VALID_NAMES.has(g.name))

export function getActiveGewerkeSeo(): GewerkSeo[] {
  return GEWERKE_SEO.filter((g) => g.active)
}

export function getGewerkSeoBySlug(slug: string): GewerkSeo | undefined {
  return GEWERKE_SEO.find((g) => g.slug === slug && g.active)
}

/** Für Debug/Tests: stellt sicher, dass jeder Slug tatsächlich slugify(name) entspricht. */
export function isSlugConsistent(g: GewerkSeo): boolean {
  return g.slug === slugify(g.name)
}
