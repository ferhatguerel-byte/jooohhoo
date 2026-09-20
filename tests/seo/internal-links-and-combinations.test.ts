import { describe, it, expect } from 'vitest'
import { getRelatedServiceLinks, getRelatedCityLinks } from '@/lib/seo/internal-links'
import { getCuratedGewerkCityCombinations, isCuratedCombination } from '@/lib/seo/curated-combinations'
import { getActiveGewerkeSeo } from '@/lib/seo/gewerke-seo'
import { getActiveCities } from '@/lib/seo/cities'

describe('Internal Linking (kontrolliert, keine Linkfarm)', () => {
  it('getRelatedServiceLinks liefert nie mehr als 4 Links', () => {
    const links = getRelatedServiceLinks('trockenbau', 'berlin')
    expect(links.length).toBeLessThanOrEqual(4)
  })

  it('getRelatedCityLinks verlinkt niemals auf die aktuelle Stadt selbst', () => {
    const links = getRelatedCityLinks('trockenbau', 'berlin')
    expect(links.every((l) => !l.href.endsWith('/berlin'))).toBe(true)
    expect(links.length).toBeLessThanOrEqual(4)
  })

  it('unbekanntes Gewerk liefert leere Linklisten statt eines Fehlers', () => {
    expect(getRelatedServiceLinks('unbekannt', 'berlin')).toEqual([])
    expect(getRelatedCityLinks('unbekannt', 'berlin')).toEqual([])
  })
})

describe('Kuratierte Gewerk×Stadt-Kombinationen (Duplicate-URL- / Massenproduktions-Schutz)', () => {
  it('Anzahl entspricht exakt aktive Gewerke × aktive Städte (kein kombinatorisches Wachstum darüber hinaus)', () => {
    const combos = getCuratedGewerkCityCombinations()
    expect(combos.length).toBe(getActiveGewerkeSeo().length * getActiveCities().length)
  })

  it('keine doppelten Kombinationen', () => {
    const combos = getCuratedGewerkCityCombinations()
    const keys = combos.map((c) => `${c.gewerkSlug}::${c.citySlug}`)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('isCuratedCombination erkennt bekannte und lehnt beliebig erratene Kombinationen ab', () => {
    expect(isCuratedCombination('trockenbau', 'berlin')).toBe(true)
    expect(isCuratedCombination('trockenbau', 'nicht-existierende-stadt')).toBe(false)
    expect(isCuratedCombination('unbekanntes-gewerk', 'berlin')).toBe(false)
  })
})
