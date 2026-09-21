import { describe, it, expect, vi, beforeEach } from 'vitest'

const { requireAdminMock, getMatchingFunnelReportMock, resolveAnalyticsDateRangeSpy } = vi.hoisted(() => ({
  requireAdminMock: vi.fn(),
  getMatchingFunnelReportMock: vi.fn(),
  resolveAnalyticsDateRangeSpy: vi.fn(),
}))
vi.mock('@/lib/authorization', () => ({ requireAdmin: requireAdminMock }))
vi.mock('@/lib/analytics-queries', async () => {
  const actual = await vi.importActual<typeof import('@/lib/analytics-queries')>('@/lib/analytics-queries')
  return {
    ...actual,
    getMatchingFunnelReport: getMatchingFunnelReportMock,
    resolveAnalyticsDateRange: (...args: Parameters<typeof actual.resolveAnalyticsDateRange>) => {
      resolveAnalyticsDateRangeSpy(...args)
      return actual.resolveAnalyticsDateRange(...args)
    },
  }
})

import MatchingAnalyticsPage from '@/app/dashboard/admin/analytics/page'

const EMPTY_REPORT = {
  range: { from: '2026-08-22T00:00:00.000Z', to: '2026-09-21T00:00:00.000Z' },
  counts: {
    projectCreated: 0,
    matchCreated: 0,
    matchNotificationCreated: 0,
    matchEmailSent: 0,
    matchNotificationRead: 0,
    jobViewed: 0,
    offerReceived: 0,
    offerAccepted: 0,
  },
  uniqueEntities: {
    uniqueJobsCreated: 0,
    uniqueJobsWithMatch: 0,
    uniqueJobsWithNotification: 0,
    uniqueNotificationsCreated: 0,
    uniqueNotificationsRead: 0,
    uniqueJobsViewed: 0,
    uniqueJobsWithOffer: 0,
    uniqueJobsAwarded: 0,
  },
  conversionRates: {
    matchPerJob: null,
    notificationPerMatchedJob: null,
    readPerNotification: null,
    viewPerNotifiedJob: null,
    offerPerViewedJob: null,
    awardPerOfferedJob: null,
  },
  daily: [],
}

describe('MatchingAnalyticsPage (/dashboard/admin/analytics) — Phase 3.6H Admin-Auth/Security', () => {
  beforeEach(() => {
    requireAdminMock.mockReset()
    getMatchingFunnelReportMock.mockReset()
    resolveAnalyticsDateRangeSpy.mockReset()
    getMatchingFunnelReportMock.mockResolvedValue(EMPTY_REPORT)
  })

  it('ruft requireAdmin() auf, BEVOR irgendeine Analytics-Query ausgeführt wird (bestehende zentrale Admin-Auth, keine eigene Logik)', async () => {
    requireAdminMock.mockResolvedValue({ id: 'admin-1', role: 'auftraggeber', email: 'admin@example.com' })
    await MatchingAnalyticsPage({ searchParams: Promise.resolve({}) })
    expect(requireAdminMock).toHaveBeenCalledTimes(1)
    const authOrder = requireAdminMock.mock.invocationCallOrder[0]
    const queryOrder = getMatchingFunnelReportMock.mock.invocationCallOrder[0]
    expect(authOrder).toBeLessThan(queryOrder)
  })

  it('wenn requireAdmin() ablehnt (wirft, wie beim bestehenden redirect-Verhalten für Nicht-Admins), wird KEINE Analytics-Query ausgeführt', async () => {
    requireAdminMock.mockImplementation(() => {
      throw new Error('REDIRECT:/dashboard')
    })
    await expect(MatchingAnalyticsPage({ searchParams: Promise.resolve({}) })).rejects.toThrow('REDIRECT:/dashboard')
    expect(getMatchingFunnelReportMock).not.toHaveBeenCalled()
  })

  it('Query-Parameter werden ausschließlich für den Zeitraum genutzt, nie als provider_id/job_id-Filter (kein solcher Parameter existiert in der Seite)', async () => {
    requireAdminMock.mockResolvedValue({ id: 'admin-1', role: 'auftraggeber', email: 'admin@example.com' })
    await MatchingAnalyticsPage({
      searchParams: Promise.resolve({ range: '7d', providerId: 'irgendwer', jobId: 'irgendwas' } as never),
    })
    // resolveAnalyticsDateRange() erhält die rohen Parameter, aber getMatchingFunnelReport()
    // nimmt ausschließlich ein aufgelöstes {preset, from, to} entgegen - kein Weg, providerId/jobId
    // aus der URL in die SQL-Query zu schleusen.
    const [rangeArg] = getMatchingFunnelReportMock.mock.calls[0]
    expect(rangeArg).not.toHaveProperty('providerId')
    expect(rangeArg).not.toHaveProperty('jobId')
    expect(Object.keys(rangeArg).sort()).toEqual(['from', 'preset', 'to'])
  })

  it('unbekannter/leerer Zeitraum-Parameter führt zu einem sicheren Default statt einem Fehler', async () => {
    requireAdminMock.mockResolvedValue({ id: 'admin-1', role: 'auftraggeber', email: 'admin@example.com' })
    await expect(MatchingAnalyticsPage({ searchParams: Promise.resolve({ range: 'garbage' }) })).resolves.toBeDefined()
    const [rangeArg] = getMatchingFunnelReportMock.mock.calls[0]
    expect(rangeArg.preset).toBe('30d')
  })

  it('führt für einen einzelnen Seitenaufruf genau eine Report-Query aus (kein Query-pro-KPI-Aufruf auf Seitenebene)', async () => {
    requireAdminMock.mockResolvedValue({ id: 'admin-1', role: 'auftraggeber', email: 'admin@example.com' })
    await MatchingAnalyticsPage({ searchParams: Promise.resolve({}) })
    expect(getMatchingFunnelReportMock).toHaveBeenCalledTimes(1)
  })
})
