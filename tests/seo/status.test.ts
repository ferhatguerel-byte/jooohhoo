import { describe, it, expect, vi, beforeEach } from 'vitest'

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }))
vi.mock('@/lib/db', () => ({ getDb: () => ({ query: queryMock }) }))

import {
  evaluateLandingPage,
  setAdminSeoStatus,
  isIndexableStatus,
  clearAdminOverride,
  saveAdminNote,
  listSeoLandingPages,
  getSeoLandingPageById,
} from '@/lib/seo/status'
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

describe('clearAdminOverride', () => {
  beforeEach(() => {
    queryMock.mockReset()
  })

  it('setzt status_source zurück auf AUTO, ohne den Status selbst zu verändern', async () => {
    queryMock.mockResolvedValueOnce({})
    await clearAdminOverride({ pageType: 'handwerker', gewerkSlug: 'trockenbau', citySlug: 'berlin' })
    const [sql] = queryMock.mock.calls[0]
    expect(sql).toContain("status_source = 'AUTO'")
    expect(sql).not.toContain('status =')
  })
})

describe('saveAdminNote', () => {
  beforeEach(() => {
    queryMock.mockReset()
  })

  it('ändert nur admin_note, nie status oder status_source', async () => {
    queryMock.mockResolvedValueOnce({})
    await saveAdminNote({ pageType: 'handwerker', gewerkSlug: 'trockenbau', citySlug: 'berlin' }, 'geprüft am 21.09.')
    const [sql, params] = queryMock.mock.calls[0]
    expect(sql).not.toContain('status_source')
    expect(sql).toMatch(/SET admin_note/)
    expect(params).toContain('geprüft am 21.09.')
  })
})

describe('listSeoLandingPages — Filter', () => {
  beforeEach(() => {
    queryMock.mockReset()
    queryMock.mockResolvedValue({ rows: [] })
  })

  it('baut WHERE-Klauseln nur für tatsächlich gesetzte Filter', async () => {
    await listSeoLandingPages({ status: 'REVIEW', gewerkSlug: 'trockenbau' })
    const [sql, params] = queryMock.mock.calls[0]
    expect(sql).toContain('status = $1')
    expect(sql).toContain('gewerk_slug = $2')
    expect(sql).not.toMatch(/WHERE[\s\S]*city_slug\s*=/)
    expect(params).toEqual(['REVIEW', 'trockenbau'])
  })

  it('ohne Filter kein WHERE (alle Zeilen, begrenzt durch LIMIT)', async () => {
    await listSeoLandingPages({})
    const [sql] = queryMock.mock.calls[0]
    expect(sql).not.toContain('WHERE')
    expect(sql).toContain('LIMIT 500')
  })

  it('mappt quality_breakdown korrekt in breakdown/missingReasons', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          id: 'p1',
          page_type: 'handwerker',
          gewerk_slug: 'trockenbau',
          city_slug: 'berlin',
          leistung_slug: null,
          status: 'NOINDEX',
          status_source: 'AUTO',
          quality_score: 40,
          quality_breakdown: { breakdown: { uniqueContent: 0 }, missingReasons: { uniqueContent: 'kein Text' } },
          admin_note: null,
          updated_at: '2026-01-01T00:00:00.000Z',
        },
      ],
    })
    const [page] = await listSeoLandingPages()
    expect(page.breakdown).toEqual({ uniqueContent: 0 })
    expect(page.missingReasons).toEqual({ uniqueContent: 'kein Text' })
  })
})

describe('getSeoLandingPageById', () => {
  beforeEach(() => {
    queryMock.mockReset()
  })

  it('gibt null zurück, wenn keine Zeile gefunden wird', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] })
    expect(await getSeoLandingPageById('does-not-exist')).toBeNull()
  })
})
