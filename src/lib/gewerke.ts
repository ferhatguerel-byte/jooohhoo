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
] as const

export type Gewerk = (typeof GEWERKE)[number]
