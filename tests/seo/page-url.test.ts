import { describe, it, expect } from 'vitest'
import { seoPageUrlPath } from '@/lib/seo/page-url'

describe('seoPageUrlPath', () => {
  it('handwerker (Gewerk×Stadt)', () => {
    expect(seoPageUrlPath({ pageType: 'handwerker', gewerkSlug: 'trockenbau', citySlug: 'berlin' })).toBe(
      '/handwerker/trockenbau/berlin'
    )
  })

  it('handwerker_gewerk (nur Gewerk)', () => {
    expect(seoPageUrlPath({ pageType: 'handwerker_gewerk', gewerkSlug: 'trockenbau' })).toBe('/handwerker/trockenbau')
  })

  it('nachunternehmer (Gewerk×Stadt)', () => {
    expect(seoPageUrlPath({ pageType: 'nachunternehmer', gewerkSlug: 'elektro', citySlug: 'hamburg' })).toBe(
      '/nachunternehmer/elektro/hamburg'
    )
  })

  it('leistung', () => {
    expect(seoPageUrlPath({ pageType: 'leistung', leistungSlug: 'badsanierung' })).toBe('/leistungen/badsanierung')
  })

  it('baukosten', () => {
    expect(seoPageUrlPath({ pageType: 'baukosten', leistungSlug: 'badsanierung' })).toBe('/baukosten/badsanierung')
  })

  it('branchenbuch_gewerk / branchenbuch_stadt / branchenbuch_kombi', () => {
    expect(seoPageUrlPath({ pageType: 'branchenbuch_gewerk', gewerkSlug: 'trockenbau' })).toBe('/branchenbuch/trockenbau')
    expect(seoPageUrlPath({ pageType: 'branchenbuch_stadt', citySlug: 'berlin' })).toBe('/branchenbuch/berlin')
    expect(seoPageUrlPath({ pageType: 'branchenbuch_kombi', gewerkSlug: 'trockenbau', citySlug: 'berlin' })).toBe(
      '/branchenbuch/trockenbau/berlin'
    )
  })

  it('gibt null zurück, wenn erforderliche Slugs fehlen (kein kaputter Link statt Fehler)', () => {
    expect(seoPageUrlPath({ pageType: 'handwerker', gewerkSlug: 'trockenbau' })).toBeNull()
    expect(seoPageUrlPath({ pageType: 'leistung' })).toBeNull()
    expect(seoPageUrlPath({ pageType: 'branchenbuch_kombi', gewerkSlug: 'trockenbau' })).toBeNull()
  })
})
