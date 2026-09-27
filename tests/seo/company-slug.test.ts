import { describe, it, expect, vi, beforeEach } from 'vitest'

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }))
vi.mock('@/lib/db', () => ({ getDb: () => ({ query: queryMock }) }))

import { getOrCreateCompanySlug, ensureCompanySlugs, getCompanyBySlug } from '@/lib/company-slug'

describe('getOrCreateCompanySlug', () => {
  beforeEach(() => {
    queryMock.mockReset()
  })

  it('gibt einen bereits vorhandenen Slug unverändert zurück, ohne ihn neu zu schreiben', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ company_slug: 'mustermann-gmbh-1a2b3c4d' }] })
    const slug = await getOrCreateCompanySlug('1a2b3c4d-0000-0000-0000-000000000000', 'Mustermann GmbH')
    expect(slug).toBe('mustermann-gmbh-1a2b3c4d')
    expect(queryMock).toHaveBeenCalledTimes(1) // nur SELECT, kein UPDATE
  })

  it('erzeugt und persistiert einen neuen, stabilen Slug, wenn noch keiner existiert', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ company_slug: null }] })
    queryMock.mockResolvedValueOnce({}) // UPDATE

    const slug = await getOrCreateCompanySlug('1a2b3c4d-0000-0000-0000-000000000000', 'Müller & Söhne Bau')
    expect(slug).toBe('mueller-soehne-bau-1a2b3c4d')
    expect(queryMock).toHaveBeenCalledTimes(2)
    expect(queryMock.mock.calls[1][0]).toContain('UPDATE users SET company_slug')
  })

  it('fällt bei einem leeren/nicht-slugifizierbaren Namen auf "firma" zurück statt einen leeren Slug zu erzeugen', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ company_slug: null }] })
    queryMock.mockResolvedValueOnce({})
    const slug = await getOrCreateCompanySlug('1a2b3c4d-0000-0000-0000-000000000000', '!!!')
    expect(slug).toBe('firma-1a2b3c4d')
  })
})

describe('ensureCompanySlugs', () => {
  beforeEach(() => {
    queryMock.mockReset()
  })

  it('lässt Zeilen mit vorhandenem Slug unverändert und backfillt nur fehlende', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ company_slug: null }] }) // für Zeile 2
    queryMock.mockResolvedValueOnce({})

    const rows = [
      { id: 'a', company_name: 'A GmbH', company_slug: 'a-gmbh-aaaaaaaa' },
      { id: 'b', company_name: 'B GmbH', company_slug: null },
    ]
    const result = await ensureCompanySlugs(rows)
    expect(result[0].company_slug).toBe('a-gmbh-aaaaaaaa')
    expect(result[1].company_slug).toBe('b-gmbh-b')
  })
})

describe('getCompanyBySlug — Admin-Unternehmensverwaltung: zentrale Eligibility-Regel', () => {
  beforeEach(() => {
    queryMock.mockReset()
  })

  it('nutzt die zentrale publicProviderSqlCondition (schließt account_status != \'active\' aus)', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] })
    await getCompanyBySlug('mustermann-gmbh')
    const [sql] = queryMock.mock.calls[0]
    expect(sql).toContain("account_status = 'active'")
    expect(sql).toContain("role = 'subunternehmer'")
    expect(sql).toContain('directory_listed = true')
    expect(sql).toContain("subscription_status = 'active'")
  })

  it('gibt null zurück, wenn keine Zeile die Bedingung erfüllt (z.B. gesperrtes/gelöschtes Unternehmen)', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] })
    const result = await getCompanyBySlug('gesperrte-firma')
    expect(result).toBeNull()
  })
})
