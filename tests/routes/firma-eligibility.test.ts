import { describe, it, expect, vi, beforeEach } from 'vitest'

const { queryMock, getCurrentUserMock, notFoundMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
  notFoundMock: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
}))
vi.mock('@/lib/db', () => ({ getDb: () => ({ query: queryMock }) }))
vi.mock('@/lib/current-user', () => ({ getCurrentUser: getCurrentUserMock }))
vi.mock('next/navigation', () => ({ notFound: notFoundMock }))

import FirmaPage, { generateMetadata } from '@/app/firma/[slug]/page'

describe('Admin-Unternehmensverwaltung – /firma/[slug] liefert 404 für nicht öffentlich sichtbare Unternehmen', () => {
  beforeEach(() => {
    queryMock.mockReset()
    getCurrentUserMock.mockReset()
    getCurrentUserMock.mockResolvedValue(null)
    notFoundMock.mockClear()
  })

  it('die zugrunde liegende Query filtert auf account_status = \'active\' (Sperrung/Löschung wirkt sofort)', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] })
    await generateMetadata({ params: Promise.resolve({ slug: 'gesperrte-firma' }) })
    const [sql] = queryMock.mock.calls[0]
    expect(sql).toContain("account_status = 'active'")
  })

  it('ein gesperrtes/gelöschtes Unternehmen (kein Treffer in der Query) löst notFound() aus', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] })
    await expect(
      FirmaPage({ params: Promise.resolve({ slug: 'gesperrte-firma' }) })
    ).rejects.toThrow('NEXT_NOT_FOUND')
    expect(notFoundMock).toHaveBeenCalledTimes(1)
  })

  it('generateMetadata gibt für ein nicht sichtbares Unternehmen leere Metadaten zurück (kein Crash)', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] })
    const metadata = await generateMetadata({ params: Promise.resolve({ slug: 'gesperrte-firma' }) })
    expect(metadata).toEqual({})
  })
})
