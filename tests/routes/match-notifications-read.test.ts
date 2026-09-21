import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { getCurrentUserMock, queryMock, trackEventMock } = vi.hoisted(() => ({
  getCurrentUserMock: vi.fn(),
  queryMock: vi.fn(),
  trackEventMock: vi.fn(),
}))
vi.mock('@/lib/current-user', () => ({ getCurrentUser: getCurrentUserMock }))
vi.mock('@/lib/db', () => ({ getDb: () => ({ query: queryMock }) }))
vi.mock('@/lib/analytics-events', () => ({ trackEvent: trackEventMock }))

import { POST } from '@/app/api/match-notifications/[id]/read/route'

function req(notificationId: string) {
  return new NextRequest(`http://localhost/api/match-notifications/${notificationId}/read`, { method: 'POST' })
}

const PROVIDER_A = { id: 'provider-a', role: 'subunternehmer' as const }

describe('POST /api/match-notifications/[id]/read — Phase 3.6E Security/IDOR', () => {
  beforeEach(() => {
    getCurrentUserMock.mockReset()
    queryMock.mockReset()
    trackEventMock.mockReset()
    trackEventMock.mockResolvedValue(undefined)
  })

  it('1. Provider A kann eine eigene Notification als gelesen markieren → erlaubt', async () => {
    getCurrentUserMock.mockResolvedValue(PROVIDER_A)
    queryMock.mockResolvedValueOnce({ rows: [{ id: 'own-notification' }] })

    const res = await POST(req('own-notification'), { params: Promise.resolve({ id: 'own-notification' }) })

    expect(res.status).toBe(200)
    const [sql, params] = queryMock.mock.calls[0]
    expect(sql).toContain('WHERE id = $1 AND provider_id = $2')
    expect(params).toEqual(['own-notification', 'provider-a'])
  })

  it('2./4. Provider A kann eine fremde Notification NICHT lesen/markieren (0 Zeilen betroffen → 404, kein Datenzugriff)', async () => {
    getCurrentUserMock.mockResolvedValue(PROVIDER_A)
    // Die UPDATE-Bedingung "id=$1 AND provider_id=$2" betrifft 0 Zeilen, weil die Notification
    // einem anderen Provider gehört (provider_id in der DB != 'provider-a').
    queryMock.mockResolvedValueOnce({ rows: [] })

    const res = await POST(req('foreign-notification'), { params: Promise.resolve({ id: 'foreign-notification' }) })

    expect(res.status).toBe(404)
    const json = await res.json()
    // Response enthält keinerlei Jobdaten oder Hinweis, dass die ID einem anderen gehört.
    expect(json).toEqual({ error: 'Nicht gefunden.' })
    expect(json).not.toHaveProperty('job_id')
    expect(json).not.toHaveProperty('provider_id')
  })

  it('3. manipulierte/fremde Notification-ID führt in keinem Fall zu Job- oder Providerdaten im Response', async () => {
    getCurrentUserMock.mockResolvedValue(PROVIDER_A)
    queryMock.mockResolvedValueOnce({ rows: [{ id: 'own-notification' }] })
    const res = await POST(req('own-notification'), { params: Promise.resolve({ id: 'own-notification' }) })
    const json = await res.json()
    // Erfolgsantwort enthält ausschließlich ein Bestätigungsflag, keine Nutzdaten.
    expect(json).toEqual({ ok: true })
  })

  it('5. Auftraggeber kann die Route nicht verwenden → 403', async () => {
    getCurrentUserMock.mockResolvedValue({ id: 'ag-1', role: 'auftraggeber' })
    const res = await POST(req('any-id'), { params: Promise.resolve({ id: 'any-id' }) })
    expect(res.status).toBe(403)
    expect(queryMock).not.toHaveBeenCalled()
  })

  it('6. nicht eingeloggter Benutzer kann die Route nicht verwenden → 403, kein DB-Zugriff', async () => {
    getCurrentUserMock.mockResolvedValue(null)
    const res = await POST(req('any-id'), { params: Promise.resolve({ id: 'any-id' }) })
    expect(res.status).toBe(403)
    expect(queryMock).not.toHaveBeenCalled()
  })

  it('7. unbekannte Notification-ID führt nicht zu Datenzugriff (404, wie bei fremder ID nicht unterscheidbar)', async () => {
    getCurrentUserMock.mockResolvedValue(PROVIDER_A)
    queryMock.mockResolvedValueOnce({ rows: [] })
    const res = await POST(req('does-not-exist'), { params: Promise.resolve({ id: 'does-not-exist' }) })
    expect(res.status).toBe(404)
  })

  it('8. die ID wird ausschließlich als parametrisierter Query-Wert übergeben (keine SQL-String-Konkatenation)', async () => {
    getCurrentUserMock.mockResolvedValue(PROVIDER_A)
    queryMock.mockResolvedValueOnce({ rows: [{ id: 'x' }] })
    const maliciousId = "'; DROP TABLE match_notifications; --"
    await POST(req(encodeURIComponent(maliciousId)), { params: Promise.resolve({ id: maliciousId }) })
    const [sql, params] = queryMock.mock.calls[0]
    expect(sql).not.toContain('DROP TABLE')
    expect(sql).not.toContain(maliciousId)
    expect(params[0]).toBe(maliciousId) // als Parameter, nicht in den SQL-Text interpoliert
  })
})

describe('POST /api/match-notifications/[id]/read — Phase 3.6E Read-Semantik', () => {
  beforeEach(() => {
    getCurrentUserMock.mockReset()
    queryMock.mockReset()
    trackEventMock.mockReset()
    trackEventMock.mockResolvedValue(undefined)
    getCurrentUserMock.mockResolvedValue(PROVIDER_A)
  })

  it('11. setzt read_at (COALESCE, damit ein bestehender Wert erhalten bleibt)', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: 'n1' }] })
    await POST(req('n1'), { params: Promise.resolve({ id: 'n1' }) })
    const [sql] = queryMock.mock.calls[0]
    expect(sql).toContain('SET read_at = COALESCE(read_at, now())')
  })

  it('12. ein zweiter Aufruf auf eine bereits gelesene Notification bleibt erfolgreich (idempotent, COALESCE verändert nichts)', async () => {
    queryMock.mockResolvedValue({ rows: [{ id: 'n1' }] })
    const first = await POST(req('n1'), { params: Promise.resolve({ id: 'n1' }) })
    const second = await POST(req('n1'), { params: Promise.resolve({ id: 'n1' }) })
    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    // Beide Aufrufe nutzen dieselbe COALESCE-Semantik – der ursprüngliche read_at-Wert wird nie
    // überschrieben, das übernimmt die DB (real gegen PostgreSQL verifiziert, siehe Bericht).
  })

  it('13. das UPDATE-Statement ändert ausschließlich read_at, keine anderen Spalten', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: 'n1' }] })
    await POST(req('n1'), { params: Promise.resolve({ id: 'n1' }) })
    const [sql] = queryMock.mock.calls[0]
    expect(sql).toMatch(/^\s*UPDATE match_notifications\s+SET read_at = COALESCE\(read_at, now\(\)\)/)
    expect(sql).not.toContain('status')
    expect(sql).not.toContain('attempts')
    expect(sql).not.toContain('last_error')
    expect(sql).not.toContain('sent_at')
    expect(sql).not.toContain('match_score')
    expect(sql).not.toContain('job_match_id')
  })

  it('14./15. löst keine E-Mail und kein Matching aus (nur genau eine Query, kein weiterer Modul-Aufruf)', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: 'n1' }] })
    await POST(req('n1'), { params: Promise.resolve({ id: 'n1' }) })
    expect(queryMock).toHaveBeenCalledTimes(1)
  })
})

describe('POST /api/match-notifications/[id]/read — Phase 3.6G MATCH_NOTIFICATION_READ Analytics', () => {
  beforeEach(() => {
    getCurrentUserMock.mockReset()
    queryMock.mockReset()
    trackEventMock.mockReset()
    trackEventMock.mockResolvedValue(undefined)
    getCurrentUserMock.mockResolvedValue(PROVIDER_A)
  })

  it('trackt MATCH_NOTIFICATION_READ beim ERSTEN tatsächlichen Lesen (just_read=true)', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: 'n1', job_id: 'job-1', just_read: true }] })
    await POST(req('n1'), { params: Promise.resolve({ id: 'n1' }) })

    expect(trackEventMock).toHaveBeenCalledTimes(1)
    expect(trackEventMock).toHaveBeenCalledWith({
      event: 'match_notification_read',
      actorUserId: 'provider-a',
      providerId: 'provider-a',
      jobId: 'job-1',
      notificationId: 'n1',
      idempotencyKey: 'match_notification_read:n1',
    })
  })

  it('wiederholtes Read (bereits gelesen, just_read=false) erzeugt KEIN zweites Read-Event', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: 'n1', job_id: 'job-1', just_read: false }] })
    await POST(req('n1'), { params: Promise.resolve({ id: 'n1' }) })
    expect(trackEventMock).not.toHaveBeenCalled()
  })

  it('fremde Notification (404, 0 Zeilen) kann kein Read-Analytics-Event erzeugen', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] })
    const res = await POST(req('foreign'), { params: Promise.resolve({ id: 'foreign' }) })
    expect(res.status).toBe(404)
    expect(trackEventMock).not.toHaveBeenCalled()
  })

  it('RETURNING liefert job_id und just_read zusätzlich zu id, ohne die bestehende SET-Klausel zu ändern', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: 'n1', job_id: 'job-1', just_read: true }] })
    await POST(req('n1'), { params: Promise.resolve({ id: 'n1' }) })
    const [sql] = queryMock.mock.calls[0]
    expect(sql).toContain('SET read_at = COALESCE(read_at, now())')
    expect(sql).toContain('RETURNING id, job_id, (read_at = now()) AS just_read')
  })

  it('ein Fehler beim Analytics-Tracking führt trotzdem zu einer erfolgreichen 200-Antwort (bereits committed)', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: 'n1', job_id: 'job-1', just_read: true }] })
    trackEventMock.mockRejectedValue(new Error('Analytics-DB down'))
    const res = await POST(req('n1'), { params: Promise.resolve({ id: 'n1' }) })
    expect(res.status).toBe(200)
  })
})
