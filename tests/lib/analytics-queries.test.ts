import { describe, it, expect, vi, beforeEach } from 'vitest'

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }))
vi.mock('@/lib/db', () => ({ getDb: () => ({ query: queryMock }) }))

import { resolveAnalyticsDateRange, getMatchingFunnelReport } from '@/lib/analytics-queries'

const FIXED_NOW = new Date('2026-09-21T15:00:00.000Z')

describe('resolveAnalyticsDateRange — Phase 3.6H Zeitraumfilter', () => {
  it('Default (kein range-Parameter) = letzte 30 Tage', () => {
    const range = resolveAnalyticsDateRange({}, FIXED_NOW)
    expect(range.preset).toBe('30d')
    expect(range.to).toEqual(FIXED_NOW)
    expect(range.from).toEqual(new Date('2026-08-22T15:00:00.000Z'))
  })

  it('7d', () => {
    const range = resolveAnalyticsDateRange({ range: '7d' }, FIXED_NOW)
    expect(range.from).toEqual(new Date('2026-09-14T15:00:00.000Z'))
    expect(range.to).toEqual(FIXED_NOW)
  })

  it('90d', () => {
    const range = resolveAnalyticsDateRange({ range: '90d' }, FIXED_NOW)
    expect(range.from).toEqual(new Date('2026-06-23T15:00:00.000Z'))
  })

  it('month = Beginn des aktuellen UTC-Monats bis jetzt', () => {
    const range = resolveAnalyticsDateRange({ range: 'month' }, FIXED_NOW)
    expect(range.from).toEqual(new Date('2026-09-01T00:00:00.000Z'))
    expect(range.to).toEqual(FIXED_NOW)
  })

  it('custom mit gültigem from/to: to-Tag ist inklusiv (exklusive Obergrenze = Folgetag 00:00 UTC)', () => {
    const range = resolveAnalyticsDateRange({ range: 'custom', from: '2026-01-01', to: '2026-01-31' }, FIXED_NOW)
    expect(range.preset).toBe('custom')
    expect(range.from).toEqual(new Date('2026-01-01T00:00:00.000Z'))
    expect(range.to).toEqual(new Date('2026-02-01T00:00:00.000Z'))
  })

  it('custom ohne from/to fällt sicher auf Default (30d) zurück, wirft nie', () => {
    const range = resolveAnalyticsDateRange({ range: 'custom' }, FIXED_NOW)
    expect(range.preset).toBe('30d')
  })

  it('custom mit from > to fällt sicher auf Default zurück', () => {
    const range = resolveAnalyticsDateRange({ range: 'custom', from: '2026-02-01', to: '2026-01-01' }, FIXED_NOW)
    expect(range.preset).toBe('30d')
  })

  it('custom mit ungültigem Datumsformat fällt sicher auf Default zurück (keine SQL-Injection-Fläche)', () => {
    const range = resolveAnalyticsDateRange({ range: 'custom', from: "'; DROP TABLE analytics_events; --", to: '2026-01-01' }, FIXED_NOW)
    expect(range.preset).toBe('30d')
  })

  it('unbekannter range-Wert fällt sicher auf Default zurück', () => {
    const range = resolveAnalyticsDateRange({ range: 'unbekannt' }, FIXED_NOW)
    expect(range.preset).toBe('30d')
  })
})

function aggregateRow(overrides: Partial<Record<string, number>> = {}) {
  return {
    project_created: 0,
    match_created: 0,
    match_notification_created: 0,
    match_email_sent: 0,
    match_notification_read: 0,
    job_viewed: 0,
    offer_received: 0,
    offer_accepted: 0,
    unique_jobs_created: 0,
    unique_jobs_with_match: 0,
    unique_jobs_with_notification: 0,
    unique_notifications_created: 0,
    unique_notifications_read: 0,
    unique_jobs_viewed: 0,
    unique_jobs_with_offer: 0,
    unique_jobs_awarded: 0,
    ...overrides,
  }
}

describe('getMatchingFunnelReport — Phase 3.6H (gemockte DB)', () => {
  beforeEach(() => {
    queryMock.mockReset()
  })

  const range = { preset: '30d' as const, from: new Date('2026-08-22T00:00:00.000Z'), to: new Date('2026-09-21T00:00:00.000Z') }

  it('führt genau zwei Queries aus (Aggregat + Tagesaggregation), keine Query pro KPI', async () => {
    queryMock.mockResolvedValueOnce({ rows: [aggregateRow()] })
    queryMock.mockResolvedValueOnce({ rows: [] })
    await getMatchingFunnelReport(range)
    expect(queryMock).toHaveBeenCalledTimes(2)
  })

  it('SQL nutzt COUNT(*) FILTER für alle 8 Event-Typen, keine 8 separaten Queries', async () => {
    queryMock.mockResolvedValueOnce({ rows: [aggregateRow()] })
    queryMock.mockResolvedValueOnce({ rows: [] })
    await getMatchingFunnelReport(range)
    const [sql] = queryMock.mock.calls[0]
    for (const type of [
      'project_created',
      'match_created',
      'match_notification_created',
      'match_email_sent',
      'match_notification_read',
      'job_viewed',
      'offer_received',
      'offer_accepted',
    ]) {
      expect(sql).toContain(`event_type = '${type}'`)
    }
  })

  it('from/to werden parametrisiert übergeben (keine String-Interpolation)', async () => {
    queryMock.mockResolvedValueOnce({ rows: [aggregateRow()] })
    queryMock.mockResolvedValueOnce({ rows: [] })
    await getMatchingFunnelReport(range)
    const [sql, params] = queryMock.mock.calls[0]
    expect(sql).toContain('occurred_at >= $1 AND occurred_at < $2')
    expect(params).toEqual([range.from, range.to])
  })

  it('Event-Counts werden korrekt gemappt', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [
        aggregateRow({
          project_created: 10,
          match_created: 40,
          match_notification_created: 30,
          match_email_sent: 28,
          match_notification_read: 15,
          job_viewed: 12,
          offer_received: 5,
          offer_accepted: 2,
        }),
      ],
    })
    queryMock.mockResolvedValueOnce({ rows: [] })
    const report = await getMatchingFunnelReport(range)
    expect(report.counts).toEqual({
      projectCreated: 10,
      matchCreated: 40,
      matchNotificationCreated: 30,
      matchEmailSent: 28,
      matchNotificationRead: 15,
      jobViewed: 12,
      offerReceived: 5,
      offerAccepted: 2,
    })
  })

  it('keine Daten im Zeitraum → 0 statt NULL/NaN/Fehler', async () => {
    queryMock.mockResolvedValueOnce({ rows: [aggregateRow()] })
    queryMock.mockResolvedValueOnce({ rows: [] })
    const report = await getMatchingFunnelReport(range)
    expect(Object.values(report.counts).every((v) => v === 0)).toBe(true)
    expect(Object.values(report.uniqueEntities).every((v) => v === 0)).toBe(true)
    expect(report.daily).toEqual([])
  })

  it('Conversion-Raten: korrekte Division über eindeutige Entitäten', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [
        aggregateRow({
          unique_jobs_created: 100,
          unique_jobs_with_match: 80,
          unique_jobs_with_notification: 40,
          unique_notifications_created: 50,
          unique_notifications_read: 25,
          unique_jobs_viewed: 20,
          unique_jobs_with_offer: 10,
          unique_jobs_awarded: 5,
        }),
      ],
    })
    queryMock.mockResolvedValueOnce({ rows: [] })
    const report = await getMatchingFunnelReport(range)
    expect(report.conversionRates).toEqual({
      matchPerJob: 0.8,
      notificationPerMatchedJob: 0.5,
      readPerNotification: 0.5,
      viewPerNotifiedJob: 0.5,
      offerPerViewedJob: 0.5,
      awardPerOfferedJob: 0.5,
    })
  })

  it('Conversion-Rate ist null (nicht NaN/Infinity) bei Nenner 0', async () => {
    queryMock.mockResolvedValueOnce({ rows: [aggregateRow({ unique_jobs_created: 0, unique_jobs_with_match: 0 })] })
    queryMock.mockResolvedValueOnce({ rows: [] })
    const report = await getMatchingFunnelReport(range)
    expect(report.conversionRates.matchPerJob).toBeNull()
  })

  it('Tagesaggregation nutzt date_trunc(...AT TIME ZONE UTC) für konsistente Zeitzone', async () => {
    queryMock.mockResolvedValueOnce({ rows: [aggregateRow()] })
    queryMock.mockResolvedValueOnce({ rows: [] })
    await getMatchingFunnelReport(range)
    const [sql] = queryMock.mock.calls[1]
    expect(sql).toContain("AT TIME ZONE 'UTC'")
    expect(sql).toContain('GROUP BY')
  })

  it('Tagesaggregation wird korrekt gemappt', async () => {
    queryMock.mockResolvedValueOnce({ rows: [aggregateRow()] })
    queryMock.mockResolvedValueOnce({
      rows: [
        { day: '2026-09-21', jobs: 3, matches: 10, notifications: 8, offers: 2, awards: 1 },
        { day: '2026-09-20', jobs: 1, matches: 4, notifications: 3, offers: 0, awards: 0 },
      ],
    })
    const report = await getMatchingFunnelReport(range)
    expect(report.daily).toEqual([
      { day: '2026-09-21', jobs: 3, matches: 10, notifications: 8, offers: 2, awards: 1 },
      { day: '2026-09-20', jobs: 1, matches: 4, notifications: 3, offers: 0, awards: 0 },
    ])
  })
})
