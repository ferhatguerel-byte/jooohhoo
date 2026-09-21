import { describe, it, expect, vi, beforeEach } from 'vitest'

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }))
vi.mock('@/lib/db', () => ({ getDb: () => ({ query: queryMock }) }))

import { buildBranchenbuchMetadata } from '@/components/seo/BranchenbuchGewerkOrStadtPage'
import { getGewerkSeoBySlug } from '@/lib/seo/gewerke-seo'
import { getCityBySlug } from '@/lib/seo/cities'

const gewerk = getGewerkSeoBySlug('trockenbau')!
const city = getCityBySlug('berlin')!

describe('/branchenbuch/[gewerk]/[stadt] — Quality-Gate-Anbindung (Phase 2.1 §1)', () => {
  beforeEach(() => {
    queryMock.mockReset()
  })

  it('ohne echte Anbieter: NOINDEX, niemals automatisch INDEXABLE', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] }) // loadCompanies: keine Firmen
    queryMock.mockResolvedValueOnce({ rows: [] }) // evaluateLandingPage: kein bestehender Eintrag
    queryMock.mockResolvedValueOnce({}) // evaluateLandingPage: INSERT/UPSERT

    const meta = await buildBranchenbuchMetadata({ gewerk, city })
    expect(meta.robots).toEqual({ index: false, follow: true })
    expect(meta.alternates?.canonical).toBe(`/branchenbuch/${gewerk.slug}/${city.slug}`)
  })

  it('mit echten Anbietern bleibt der automatisch ermittelte Status höchstens REVIEW', async () => {
    const companyRow = {
      id: 'c1',
      company_name: 'Trockenbau Berlin GmbH',
      company_slug: 'trockenbau-berlin-gmbh-c1111111',
      gewerke: ['Trockenbau'],
      plz: '10115',
      ort: 'Berlin',
      verification_status: 'verified',
      avg_rating: 4.8,
      review_count: 12,
    }
    queryMock.mockResolvedValueOnce({ rows: [companyRow] }) // loadCompanies
    queryMock.mockResolvedValueOnce({ rows: [] }) // evaluateLandingPage: kein bestehender Eintrag
    queryMock.mockResolvedValueOnce({}) // evaluateLandingPage: INSERT/UPSERT

    const meta = await buildBranchenbuchMetadata({ gewerk, city })
    // Egal wie hoch der Score ausfällt: eine AUTO-Bewertung darf hier nie index:true liefern.
    expect(meta.robots).not.toEqual({ index: true, follow: true })
  })

  it('ein per Admin freigegebener Eintrag ergibt tatsächlich index:true', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] }) // loadCompanies
    queryMock.mockResolvedValueOnce({ rows: [{ status: 'INDEXABLE', status_source: 'ADMIN' }] }) // bereits von Admin freigegeben
    queryMock.mockResolvedValueOnce({}) // UPSERT (Score wird trotzdem aktualisiert, Status bleibt)

    const meta = await buildBranchenbuchMetadata({ gewerk, city })
    expect(meta.robots).toEqual({ index: true, follow: true })
  })

  it('reine Gewerk- oder Stadt-Kategorieseiten durchlaufen kein Quality Gate und bekommen kein robots-Override', async () => {
    const meta = await buildBranchenbuchMetadata({ gewerk })
    expect(meta.robots).toBeUndefined()
    expect(queryMock).not.toHaveBeenCalled()
  })
})
