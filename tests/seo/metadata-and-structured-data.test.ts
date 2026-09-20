import { describe, it, expect } from 'vitest'
import { fillTemplate, buildLandingPageMetadata } from '@/lib/seo/metadata'
import { buildBreadcrumbJsonLd, buildServiceJsonLd, buildAggregateRatingJsonLd } from '@/lib/seo/structured-data'

describe('fillTemplate', () => {
  it('ersetzt alle Platzhalter', () => {
    expect(fillTemplate('{gewerk} in {stadt}', { gewerk: 'Trockenbau', stadt: 'Berlin' })).toBe('Trockenbau in Berlin')
  })

  it('lässt unbekannte Platzhalter unverändert', () => {
    expect(fillTemplate('{unbekannt} Test', { stadt: 'Berlin' })).toBe('{unbekannt} Test')
  })
})

describe('buildLandingPageMetadata (Quality-Gate -> robots)', () => {
  it('INDEXABLE-Seiten bekommen index:true', () => {
    const meta = buildLandingPageMetadata({
      title: 'Titel',
      description: 'Beschreibung',
      canonicalPath: '/handwerker/trockenbau/berlin',
      status: 'INDEXABLE',
    })
    expect(meta.robots).toEqual({ index: true, follow: true })
    expect(meta.alternates?.canonical).toBe('/handwerker/trockenbau/berlin')
  })

  it.each(['DRAFT', 'REVIEW', 'NOINDEX'] as const)('%s-Seiten bekommen index:false, follow:true', (status) => {
    const meta = buildLandingPageMetadata({ title: 't', description: 'd', canonicalPath: '/x', status })
    expect(meta.robots).toEqual({ index: false, follow: true })
  })
})

describe('Structured Data Builder', () => {
  it('BreadcrumbList enthält alle Items in Reihenfolge mit korrekter Position', () => {
    const jsonLd = buildBreadcrumbJsonLd([
      { name: 'Start', path: '/' },
      { name: 'Handwerker', path: '/handwerker' },
      { name: 'Trockenbau', path: '/handwerker/trockenbau' },
    ])
    expect(jsonLd['@type']).toBe('BreadcrumbList')
    expect(jsonLd.itemListElement).toHaveLength(3)
    expect(jsonLd.itemListElement[0].position).toBe(1)
    expect(jsonLd.itemListElement[2].position).toBe(3)
    expect(jsonLd.itemListElement[2].name).toBe('Trockenbau')
  })

  it('Service-JsonLd enthält niemals eine erfundene aggregateRating', () => {
    const jsonLd = buildServiceJsonLd({ name: 'Trockenbau in Berlin', description: 'x', areaServed: 'Berlin' })
    expect(jsonLd).not.toHaveProperty('aggregateRating')
  })

  it('buildAggregateRatingJsonLd gibt reale Werte 1:1 weiter (keine Erfindung)', () => {
    const rating = buildAggregateRatingJsonLd(4.5, 12)
    expect(rating.ratingValue).toBe(4.5)
    expect(rating.reviewCount).toBe(12)
  })
})
