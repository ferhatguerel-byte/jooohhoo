import { describe, it, expect, vi, beforeEach } from 'vitest'

const { queryMock, notFoundMock, getCurrentUserMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
  notFoundMock: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
  getCurrentUserMock: vi.fn(),
}))
vi.mock('@/lib/db', () => ({ getDb: () => ({ query: queryMock }) }))
vi.mock('@/lib/current-user', () => ({ getCurrentUser: getCurrentUserMock }))
vi.mock('next/navigation', () => ({
  notFound: notFoundMock,
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
}))

import BranchenbuchGewerkStadtPage, {
  generateMetadata as generateGewerkStadtMetadata,
} from '@/app/branchenbuch/[slug]/[stadt]/page'
import BranchenbuchSlugResolverPage, {
  generateMetadata as generateSlugMetadata,
} from '@/app/branchenbuch/[slug]/page'

/**
 * Phase 3.6I – Routing-Tests nach der Behebung des Next.js-Segmentnamen-Konflikts
 * (/branchenbuch/[gewerk]/[stadt] -> /branchenbuch/[slug]/[stadt], reines Ordner-/Parameter-
 * Umbenennen, URLs unverändert). Testet direkt die Page-Funktionen (kein RSC-Rendering nötig),
 * analog zum bestehenden Testmuster für Server Components in diesem Repo.
 */
describe('/branchenbuch/[slug]/[stadt] — Phase 3.6I Routing', () => {
  beforeEach(() => {
    queryMock.mockReset()
    notFoundMock.mockClear()
    queryMock.mockResolvedValue({ rows: [] })
  })

  it('gültige Gewerk×Stadt-Kombination: rendert ohne notFound()', async () => {
    await expect(
      BranchenbuchGewerkStadtPage({ params: Promise.resolve({ slug: 'trockenbau', stadt: 'berlin' }) })
    ).resolves.toBeDefined()
    expect(notFoundMock).not.toHaveBeenCalled()
  })

  it('unbekanntes Gewerk-Segment: notFound()', async () => {
    await expect(
      BranchenbuchGewerkStadtPage({ params: Promise.resolve({ slug: 'nicht-existentes-gewerk', stadt: 'berlin' }) })
    ).rejects.toThrow('NEXT_NOT_FOUND')
  })

  it('unbekanntes Stadt-Segment: notFound()', async () => {
    await expect(
      BranchenbuchGewerkStadtPage({ params: Promise.resolve({ slug: 'trockenbau', stadt: 'nicht-existente-stadt' }) })
    ).rejects.toThrow('NEXT_NOT_FOUND')
  })

  it('generateMetadata liefert für eine gültige Kombination echte Metadata (canonical enthält beide Slugs)', async () => {
    const meta = await generateGewerkStadtMetadata({ params: Promise.resolve({ slug: 'trockenbau', stadt: 'berlin' }) })
    expect(meta.alternates?.canonical).toBe('/branchenbuch/trockenbau/berlin')
  })

  it('generateMetadata liefert für eine ungültige Kombination ein leeres Objekt (kein Fehler)', async () => {
    const meta = await generateGewerkStadtMetadata({ params: Promise.resolve({ slug: 'unbekannt', stadt: 'berlin' }) })
    expect(meta).toEqual({})
  })
})

describe('/branchenbuch/[slug] — Phase 3.6I Resolver-Routing (unverändert, gleicher Ordnername wie [stadt]-Parent)', () => {
  beforeEach(() => {
    queryMock.mockReset()
    notFoundMock.mockClear()
    queryMock.mockResolvedValue({ rows: [] })
  })

  it('Gewerk-Slug allein: rendert die Gewerk-Kategorieseite, kein notFound()', async () => {
    await expect(BranchenbuchSlugResolverPage({ params: Promise.resolve({ slug: 'trockenbau' }) })).resolves.toBeDefined()
    expect(notFoundMock).not.toHaveBeenCalled()
  })

  it('Stadt-Slug allein: rendert die Stadt-Kategorieseite, kein notFound()', async () => {
    await expect(BranchenbuchSlugResolverPage({ params: Promise.resolve({ slug: 'berlin' }) })).resolves.toBeDefined()
    expect(notFoundMock).not.toHaveBeenCalled()
  })

  it('völlig unbekannter Slug (kein Gewerk, keine Stadt, kein Legacy-Firmenpräfix): notFound()', async () => {
    await expect(
      BranchenbuchSlugResolverPage({ params: Promise.resolve({ slug: 'komplett-unbekannt-xyz' }) })
    ).rejects.toThrow('NEXT_NOT_FOUND')
  })

  it('generateMetadata für Gewerk-Slug liefert Metadata', async () => {
    const meta = await generateSlugMetadata({ params: Promise.resolve({ slug: 'trockenbau' }) })
    expect(meta).not.toEqual({})
  })

  it('generateMetadata für unbekannten Slug liefert leeres Objekt', async () => {
    const meta = await generateSlugMetadata({ params: Promise.resolve({ slug: 'komplett-unbekannt-xyz' }) })
    expect(meta).toEqual({})
  })
})
