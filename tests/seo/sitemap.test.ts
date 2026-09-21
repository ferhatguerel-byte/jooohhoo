import { describe, it, expect, vi, beforeEach } from 'vitest'

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }))
vi.mock('@/lib/db', () => ({ getDb: () => ({ query: queryMock }) }))

import sitemap from '@/app/sitemap'
import { getActiveGewerkeSeo } from '@/lib/seo/gewerke-seo'
import { getActiveCities } from '@/lib/seo/cities'

describe('sitemap()', () => {
  beforeEach(() => {
    queryMock.mockReset()
  })

  it('nimmt nur INDEXABLE Gewerk×Stadt-Kombinationen auf, niemals REVIEW/NOINDEX/DRAFT', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] }) // guide_articles
    queryMock.mockResolvedValueOnce({ rows: [] }) // companies
    queryMock.mockResolvedValueOnce({
      rows: [{ page_type: 'handwerker', gewerk_slug: 'trockenbau', city_slug: 'berlin' }],
    }) // seo_landing_pages (die Query selbst filtert bereits auf status='INDEXABLE')

    const entries = await sitemap()
    const urls = entries.map((e) => e.url)

    expect(urls.some((u) => u.endsWith('/handwerker/trockenbau/berlin'))).toBe(true)
    // Die Query selbst muss nach status = 'INDEXABLE' filtern.
    const [sql] = queryMock.mock.calls[2]
    expect(sql).toContain("status = 'INDEXABLE'")
  })

  it('nimmt branchenbuch_kombi-Einträge unter /branchenbuch/[gewerk]/[stadt] auf', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] })
    queryMock.mockResolvedValueOnce({ rows: [] })
    queryMock.mockResolvedValueOnce({
      rows: [{ page_type: 'branchenbuch_kombi', gewerk_slug: 'elektro', city_slug: 'hamburg' }],
    })

    const entries = await sitemap()
    expect(entries.some((e) => e.url.endsWith('/branchenbuch/elektro/hamburg'))).toBe(true)
  })

  it('nimmt niemals /baukosten/[leistung]-URLs auf (keine validierten Kostendaten)', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] })
    queryMock.mockResolvedValueOnce({ rows: [] })
    queryMock.mockResolvedValueOnce({ rows: [] })

    const entries = await sitemap()
    expect(entries.some((e) => e.url.includes('/baukosten/'))).toBe(false)
    // /baukosten selbst (Übersicht) darf enthalten sein, nur keine Detailseiten.
    expect(entries.some((e) => e.url.endsWith('/baukosten'))).toBe(true)
  })

  it('enthält keine Dashboard-/Admin-/API-URLs', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] })
    queryMock.mockResolvedValueOnce({ rows: [] })
    queryMock.mockResolvedValueOnce({ rows: [] })

    const entries = await sitemap()
    expect(entries.some((e) => e.url.includes('/dashboard'))).toBe(false)
    expect(entries.some((e) => e.url.includes('/api/'))).toBe(false)
  })

  it('enthält keine doppelten URLs', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] })
    queryMock.mockResolvedValueOnce({ rows: [{ company_slug: 'a-gmbh-aaaaaaaa' }] })
    queryMock.mockResolvedValueOnce({ rows: [] })

    const entries = await sitemap()
    const urls = entries.map((e) => e.url)
    expect(new Set(urls).size).toBe(urls.length)
  })

  it('nimmt jede aktive Gewerk-/Stadt-Kategorieseite genau einmal auf (feste, kleine Menge)', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] })
    queryMock.mockResolvedValueOnce({ rows: [] })
    queryMock.mockResolvedValueOnce({ rows: [] })

    const entries = await sitemap()
    const urls = new Set(entries.map((e) => e.url))
    for (const g of getActiveGewerkeSeo()) {
      expect(urls.has(`http://localhost:3000/handwerker/${g.slug}`) || [...urls].some((u) => u.endsWith(`/handwerker/${g.slug}`))).toBe(true)
    }
    for (const c of getActiveCities()) {
      expect([...urls].some((u) => u.endsWith(`/branchenbuch/${c.slug}`))).toBe(true)
    }
  })

  it('fällt bei DB-Fehler auf die statischen/festen Einträge zurück, statt zu werfen', async () => {
    queryMock.mockRejectedValueOnce(new Error('DB down'))
    const entries = await sitemap()
    expect(entries.length).toBeGreaterThan(0)
    expect(entries.some((e) => e.url.endsWith('/handwerker'))).toBe(true)
  })
})
