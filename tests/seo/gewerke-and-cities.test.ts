import { describe, it, expect } from 'vitest'
import { GEWERKE_SEO, getGewerkSeoBySlug, isSlugConsistent, getActiveGewerkeSeo } from '@/lib/seo/gewerke-seo'
import { CITIES, getCityBySlug, getActiveCities, cityPlzPatterns } from '@/lib/seo/cities'
import { slugify } from '@/lib/slugify'

describe('Gewerk-SEO-Datenmodell (Slug-Generierung)', () => {
  it('jeder Gewerk-Slug ist konsistent mit slugify(name) — keine manuellen Tippfehler', () => {
    for (const g of GEWERKE_SEO) {
      expect(isSlugConsistent(g), `Slug "${g.slug}" passt nicht zu Name "${g.name}"`).toBe(true)
    }
  })

  it('keine doppelten Slugs (Duplicate-URL-Schutz)', () => {
    const slugs = GEWERKE_SEO.map((g) => g.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('jedes Gewerk hat vollständige Pflichtfelder', () => {
    for (const g of GEWERKE_SEO) {
      expect(g.id).toBeTruthy()
      expect(g.slug).toMatch(/^[a-z0-9-]+$/)
      expect(g.name).toBeTruthy()
      expect(g.shortDescription.length).toBeGreaterThan(10)
      expect(g.longDescription.length).toBeGreaterThan(20)
      expect(g.category).toBeTruthy()
      expect(g.parentCategory).toBeTruthy()
      expect(Array.isArray(g.relatedServices)).toBe(true)
      expect(g.seoTitleTemplate).toContain('{stadt}')
      expect(g.seoDescriptionTemplate.length).toBeGreaterThan(10)
    }
  })

  it('relatedServices verweisen nur auf tatsächlich existierende Gewerk-Slugs (keine toten Links)', () => {
    const knownSlugs = new Set(GEWERKE_SEO.map((g) => g.slug))
    for (const g of GEWERKE_SEO) {
      for (const related of g.relatedServices) {
        expect(knownSlugs.has(related), `"${g.slug}" verlinkt auf unbekanntes "${related}"`).toBe(true)
      }
    }
  })

  it('getGewerkSeoBySlug findet nur aktive, existierende Gewerke', () => {
    expect(getGewerkSeoBySlug('trockenbau')).toBeDefined()
    expect(getGewerkSeoBySlug('does-not-exist')).toBeUndefined()
  })

  it('getActiveGewerkeSeo liefert nur active:true Einträge', () => {
    expect(getActiveGewerkeSeo().every((g) => g.active)).toBe(true)
  })
})

describe('Städte-Datenmodell', () => {
  it('keine doppelten Stadt-Slugs', () => {
    const slugs = CITIES.map((c) => c.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('jede Stadt hat vollständige Pflichtfelder', () => {
    for (const c of CITIES) {
      expect(c.slug).toBe(slugify(c.name))
      expect(c.state).toBeTruthy()
      expect(c.region).toBeTruthy()
      expect(c.postalCodePrefixes.length).toBeGreaterThan(0)
      for (const prefix of c.postalCodePrefixes) {
        expect(prefix).toMatch(/^\d{2}$/)
      }
    }
  })

  it('getCityBySlug/getActiveCities funktionieren wie erwartet', () => {
    expect(getCityBySlug('berlin')?.name).toBe('Berlin')
    expect(getCityBySlug('nicht-vorhanden')).toBeUndefined()
    expect(getActiveCities().every((c) => c.active)).toBe(true)
  })

  it('cityPlzPatterns erzeugt gültige SQL-LIKE-Präfixe', () => {
    const berlin = getCityBySlug('berlin')!
    const patterns = cityPlzPatterns(berlin)
    expect(patterns).toEqual(berlin.postalCodePrefixes.map((p) => `${p}%`))
  })
})
