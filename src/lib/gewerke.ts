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
  'Gerüstbau',
  'Metallbau',
  'Abbruch & Entkernung',
  'Gebäudereinigung',
  'Baureinigung',
  'Fensterreinigung',
] as const

export type Gewerk = (typeof GEWERKE)[number]
