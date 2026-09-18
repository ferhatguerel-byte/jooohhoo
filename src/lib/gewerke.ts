export const GEWERKE = [
  'Trockenbau',
  'Maler & Lackierer',
  'Elektro',
  'Sanitär & Heizung',
  'Fassade',
  'Rohbau',
  'Fliesenleger',
  'Dachdecker',
  'Bodenleger',
  'Tischler & Schreiner',
  'Photovoltaik',
  'Metallbau',
  'Abbruch & Entkernung',
  'Gebäudereinigung',
  'Baureinigung',
  'Fensterreinigung',
  'Gärtner/Landschaftsbauer',
  'Umzugsunternehmer',
  'Hausmeisterservice',
  'Entrümpelungsservice',
  'Transport',
  'Winterdienst',
  'Schädlingsbekämpfer',
  'Schlüsseldienst',
] as const

export type Gewerk = (typeof GEWERKE)[number]

/**
 * Zulassungspflichtige ("meisterpflichtige") Gewerke nach Anlage A der Handwerksordnung.
 * Für diese darf ein Unternehmer erst Aufträge kontaktieren/anbieten, nachdem sein
 * Meisterbrief/Qualifikationsnachweis hochgeladen und von uns verifiziert wurde.
 */
export const MEISTERPFLICHTIGE_GEWERKE: Gewerk[] = [
  'Elektro',
  'Sanitär & Heizung',
]

export function isMeisterpflichtig(gewerk: string): boolean {
  return (MEISTERPFLICHTIGE_GEWERKE as string[]).includes(gewerk)
}
