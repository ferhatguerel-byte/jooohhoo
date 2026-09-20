import { describe, it, expect } from 'vitest'
import { computeQualityScore, suggestStatusFromScore, QUALITY_WEIGHTS, type QualityScoreInput } from '@/lib/seo/quality-score'

const baseInput: QualityScoreInput = {
  hasCuratedIntro: false,
  hasLocalFactsInTemplate: false,
  realProviderCount: 0,
  realReviewCount: 0,
  isRecognizedCity: false,
  isRecognizedService: false,
  hasRelatedServices: false,
  internalLinksCount: 0,
  hasCompleteMetadata: false,
  hasStructuredData: false,
  isCuratedCombination: false,
}

describe('Quality-Score-Gewichtung', () => {
  it('Gewichte summieren sich zu 100', () => {
    const total = Object.values(QUALITY_WEIGHTS).reduce((a, b) => a + b, 0)
    expect(total).toBe(100)
  })

  it('ein komplett leerer/unbekannter Fall ergibt Score 0', () => {
    const { score } = computeQualityScore(baseInput)
    expect(score).toBe(0)
  })

  it('ein vollständig ausgefüllter, kuratierter Fall erreicht die volle Punktzahl', () => {
    const { score } = computeQualityScore({
      hasCuratedIntro: true,
      hasLocalFactsInTemplate: true,
      realProviderCount: 10,
      realReviewCount: 20,
      isRecognizedCity: true,
      isRecognizedService: true,
      hasRelatedServices: true,
      internalLinksCount: 8,
      hasCompleteMetadata: true,
      hasStructuredData: true,
      isCuratedCombination: true,
    })
    expect(score).toBe(100)
  })

  it('eine beliebig geratene (nicht kuratierte) Kombination kann niemals die volle Punktzahl erreichen', () => {
    const { score, breakdown } = computeQualityScore({
      ...baseInput,
      hasCuratedIntro: true,
      hasLocalFactsInTemplate: true,
      realProviderCount: 10,
      realReviewCount: 20,
      isRecognizedCity: true,
      isRecognizedService: true,
      hasRelatedServices: true,
      internalLinksCount: 8,
      hasCompleteMetadata: true,
      hasStructuredData: true,
      isCuratedCombination: false, // <- der entscheidende Unterschied
    })
    expect(breakdown.userIntent).toBe(0)
    expect(score).toBeLessThan(100)
  })

  it('realProviderData skaliert mit der Anbieteranzahl, aber deckelt bei 20', () => {
    const zero = computeQualityScore({ ...baseInput, realProviderCount: 0 }).breakdown.realProviderData
    const few = computeQualityScore({ ...baseInput, realProviderCount: 2 }).breakdown.realProviderData
    const many = computeQualityScore({ ...baseInput, realProviderCount: 6 }).breakdown.realProviderData
    const extreme = computeQualityScore({ ...baseInput, realProviderCount: 500 }).breakdown.realProviderData
    expect(zero).toBe(0)
    expect(few).toBeGreaterThan(0)
    expect(many).toBe(QUALITY_WEIGHTS.realProviderData)
    expect(extreme).toBe(QUALITY_WEIGHTS.realProviderData)
  })

  it('localRelevance ist 0 für eine nicht erkannte Stadt, unabhängig von anderen Signalen', () => {
    const { breakdown } = computeQualityScore({ ...baseInput, isRecognizedCity: false, realProviderCount: 100 })
    expect(breakdown.localRelevance).toBe(0)
  })
})

describe('Score-Schwellenwerte (suggestStatusFromScore)', () => {
  it('unter 70 -> NOINDEX', () => {
    expect(suggestStatusFromScore(0)).toBe('NOINDEX')
    expect(suggestStatusFromScore(69)).toBe('NOINDEX')
  })

  it('70-84 -> REVIEW', () => {
    expect(suggestStatusFromScore(70)).toBe('REVIEW')
    expect(suggestStatusFromScore(84)).toBe('REVIEW')
  })

  it('85+ -> INDEXABLE_CANDIDATE (niemals automatisch INDEXABLE)', () => {
    expect(suggestStatusFromScore(85)).toBe('INDEXABLE_CANDIDATE')
    expect(suggestStatusFromScore(100)).toBe('INDEXABLE_CANDIDATE')
  })
})
