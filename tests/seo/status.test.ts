import { describe, it, expect, vi, beforeEach } from 'vitest'

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }))
vi.mock('@/lib/db', () => ({ getDb: () => ({ query: queryMock }) }))

import { evaluateLandingPage, setAdminSeoStatus, isIndexableStatus } from '@/lib/seo/status'
import type { QualityScoreInput } from '@/lib/seo/quality-score'

const lowScoreInput: QualityScoreInput = {
  hasCuratedIntro: false,
  hasLocalFactsInTemplate: false,
  realProviderCount: 0,
  realReviewCount: 0,
  isRecognizedCity: true,
  isRecognizedService: true,
  hasRelatedServices: false,
  internalLinksCount: 0,
  hasCompleteMetadata: true,
  hasStructuredData: true,
  isCuratedCombination: true,
}

const highScoreInput: QualityScoreInput = {
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
}

describe('evaluateLandingPage — Quality-Gate-Status', () => {
  beforeEach(() => {
    queryMock.mockReset()
  })

  it('ein niedriger Score führt automatisch zu NOINDEX, nie zu INDEXABLE', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] }) // kein bestehender Eintrag
    queryMock.mockResolvedValueOnce({}) // INSERT/UPSERT

    const result = await evaluateLandingPage(
      { pageType: 'handwerker', gewerkSlug: 'trockenbau', citySlug: 'berlin' },
      lowScoreInput
    )
    expect(result.status).toBe('NOINDEX')
    expect(result.statusSource).toBe('AUTO')
  })

  it('selbst ein sehr hoher Score (100) setzt AUTO niemals direkt auf INDEXABLE — höchstens REVIEW', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] })
    queryMock.mockResolvedValueOnce({})

    const result = await evaluateLandingPage(
      { pageType: 'handwerker', gewerkSlug: 'trockenbau', citySlug: 'berlin' },
      highScoreInput
    )
    expect(result.score).toBe(100)
    expect(result.status).toBe('REVIEW')
    expect(result.status).not.toBe('INDEXABLE')
  })

  it('ein von einem Admin gesetzter Status bleibt bei erneuter automatischer Bewertung unangetastet', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ status: 'INDEXABLE', status_source: 'ADMIN' }] })
    queryMock.mockResolvedValueOnce({})

    const result = await evaluateLandingPage(
      { pageType: 'handwerker', gewerkSlug: 'trockenbau', citySlug: 'berlin' },
      lowScoreInput // score wäre hier eigentlich NOINDEX-würdig
    )
    expect(result.status).toBe('INDEXABLE')
    expect(result.statusSource).toBe('ADMIN')
  })
})

describe('setAdminSeoStatus', () => {
  beforeEach(() => {
    queryMock.mockReset()
  })

  it('schreibt status_source = ADMIN', async () => {
    queryMock.mockResolvedValueOnce({})
    await setAdminSeoStatus({ pageType: 'handwerker', gewerkSlug: 'trockenbau', citySlug: 'berlin' }, 'INDEXABLE')
    expect(queryMock).toHaveBeenCalledOnce()
    const [sql, params] = queryMock.mock.calls[0]
    expect(sql).toContain("'ADMIN'")
    expect(params).toContain('INDEXABLE')
  })
})

describe('isIndexableStatus', () => {
  it('nur status INDEXABLE gilt als indexierbar', () => {
    expect(isIndexableStatus('INDEXABLE')).toBe(true)
    expect(isIndexableStatus('REVIEW')).toBe(false)
    expect(isIndexableStatus('NOINDEX')).toBe(false)
    expect(isIndexableStatus('DRAFT')).toBe(false)
  })
})
