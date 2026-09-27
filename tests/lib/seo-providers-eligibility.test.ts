import { describe, it, expect, vi, beforeEach } from 'vitest'

const { queryMock, ensureCompanySlugsMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
  ensureCompanySlugsMock: vi.fn(),
}))
vi.mock('@/lib/db', () => ({ getDb: () => ({ query: queryMock }) }))
vi.mock('@/lib/company-slug', () => ({ ensureCompanySlugs: ensureCompanySlugsMock }))

import { getRealProviders, countRealProviders, countRealReviews } from '@/lib/seo/providers'

const berlin = { slug: 'berlin', name: 'Berlin', postalCodePrefixes: ['10', '12', '13', '14'] } as unknown as Parameters<typeof getRealProviders>[1]

describe('Admin-Unternehmensverwaltung – lib/seo/providers.ts nutzt die zentrale Eligibility-Regel', () => {
  beforeEach(() => {
    queryMock.mockReset()
    queryMock.mockResolvedValue({ rows: [{ count: 0 }] })
    ensureCompanySlugsMock.mockReset()
    ensureCompanySlugsMock.mockResolvedValue([])
  })

  it('getRealProviders (handwerker/nachunternehmer [gewerk]/[stadt]) filtert auf account_status = \'active\'', async () => {
    await getRealProviders('Trockenbau', berlin)
    const [sql] = queryMock.mock.calls[0]
    expect(sql).toContain("u.account_status = 'active'")
  })

  it('countRealProviders filtert auf account_status = \'active\'', async () => {
    await countRealProviders('Trockenbau', berlin)
    const [sql] = queryMock.mock.calls[0]
    expect(sql).toContain("account_status = 'active'")
  })

  it('countRealReviews filtert auf account_status = \'active\'', async () => {
    await countRealReviews('Trockenbau', berlin)
    const [sql] = queryMock.mock.calls[0]
    expect(sql).toContain("u.account_status = 'active'")
  })
})
