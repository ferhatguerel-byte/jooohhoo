import { describe, it, expect, vi, beforeEach } from 'vitest'

const { queryMock, getCurrentUserMock, ensureCompanySlugsMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
  ensureCompanySlugsMock: vi.fn(),
}))
vi.mock('@/lib/db', () => ({ getDb: () => ({ query: queryMock }) }))
vi.mock('@/lib/current-user', () => ({ getCurrentUser: getCurrentUserMock }))
vi.mock('@/lib/company-slug', () => ({ ensureCompanySlugs: ensureCompanySlugsMock }))

import BranchenbuchPage from '@/app/branchenbuch/page'
import BranchenbuchGewerkOrStadtPage from '@/components/seo/BranchenbuchGewerkOrStadtPage'

describe('Admin-Unternehmensverwaltung – /branchenbuch nutzt die zentrale Eligibility-Regel', () => {
  beforeEach(() => {
    queryMock.mockReset()
    queryMock.mockResolvedValue({ rows: [] })
    getCurrentUserMock.mockReset()
    getCurrentUserMock.mockResolvedValue(null)
    ensureCompanySlugsMock.mockReset()
    ensureCompanySlugsMock.mockResolvedValue([])
  })

  it('/branchenbuch (Gesamtliste): Query filtert auf account_status = \'active\' (schließt gesperrte/gelöschte Unternehmen aus)', async () => {
    await BranchenbuchPage()
    const [sql] = queryMock.mock.calls[0]
    expect(sql).toContain("account_status = 'active'")
    expect(sql).toContain("role = 'subunternehmer'")
    expect(sql).toContain('directory_listed = true')
    expect(sql).toContain("subscription_status = 'active'")
  })

  it('/branchenbuch/[gewerk] und /branchenbuch/[gewerk]/[stadt] (BranchenbuchGewerkOrStadtPage): dieselbe Bedingung', async () => {
    await BranchenbuchGewerkOrStadtPage({})
    const [sql] = queryMock.mock.calls[0]
    expect(sql).toContain("account_status = 'active'")
  })
})
