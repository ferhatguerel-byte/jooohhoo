import { describe, it, expect, vi, beforeEach } from 'vitest'

const { getCurrentUserMock, queryMock } = vi.hoisted(() => ({
  getCurrentUserMock: vi.fn(),
  queryMock: vi.fn(),
}))
vi.mock('@/lib/current-user', () => ({ getCurrentUser: getCurrentUserMock }))
vi.mock('@/lib/db', () => ({ getDb: () => ({ query: queryMock }) }))
vi.mock('next/navigation', () => ({ redirect: vi.fn(() => { throw new Error('redirect') }) }))

import PassendeAuftraegePage from '@/app/dashboard/passende-auftraege/page'

const baseProvider = {
  id: 'sub-1',
  role: 'subunternehmer' as const,
  subscriptionStatus: 'active' as const,
}

describe('/dashboard/passende-auftraege — Matching-Lifecycle Leseseiten-Invalidierung', () => {
  beforeEach(() => {
    getCurrentUserMock.mockReset()
    queryMock.mockReset()
    queryMock.mockResolvedValue({ rows: [] })
  })

  it('lädt Notifications NUR bei aktivem Abo und filtert dabei auf job_matches.excluded=false und jobs.status=open', async () => {
    getCurrentUserMock.mockResolvedValue(baseProvider)
    await PassendeAuftraegePage()
    expect(queryMock).toHaveBeenCalledTimes(1)
    const [sql, params] = queryMock.mock.calls[0]
    expect(sql).toContain('JOIN job_matches jm ON jm.job_id = mn.job_id AND jm.provider_id = mn.provider_id')
    expect(sql).toContain("j.status = 'open'")
    expect(sql).toContain('jm.excluded = false')
    expect(params).toEqual(['sub-1'])
  })

  it('gekündigtes/inaktives Abo (subscriptionStatus != active) zeigt KEINE Matches – keine Query nötig', async () => {
    getCurrentUserMock.mockResolvedValue({ ...baseProvider, subscriptionStatus: 'canceled' })
    await PassendeAuftraegePage()
    expect(queryMock).not.toHaveBeenCalled()
  })

  it('match_notifications selbst wird nie verändert – die Seite liest ausschließlich (kein UPDATE/DELETE)', async () => {
    getCurrentUserMock.mockResolvedValue(baseProvider)
    await PassendeAuftraegePage()
    const [sql] = queryMock.mock.calls[0]
    expect(sql.trim().toUpperCase().startsWith('SELECT')).toBe(true)
  })
})
