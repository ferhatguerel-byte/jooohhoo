import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const {
  requireAdminApiMock,
  queryMock,
  clientQueryMock,
  connectMock,
  releaseMock,
  logAdminActionMock,
  matchProviderAgainstOpenJobsMock,
  delMock,
} = vi.hoisted(() => ({
  requireAdminApiMock: vi.fn(),
  queryMock: vi.fn(),
  clientQueryMock: vi.fn(),
  connectMock: vi.fn(),
  releaseMock: vi.fn(),
  logAdminActionMock: vi.fn(),
  matchProviderAgainstOpenJobsMock: vi.fn(),
  delMock: vi.fn(),
}))
vi.mock('@/lib/authorization', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  requireAdminApi: requireAdminApiMock,
}))
vi.mock('@/lib/db', () => ({ getDb: () => ({ query: queryMock, connect: connectMock }) }))
vi.mock('@/lib/admin-audit', () => ({ logAdminAction: logAdminActionMock }))
vi.mock('@/lib/matching/run-provider-matching', () => ({ matchProviderAgainstOpenJobs: matchProviderAgainstOpenJobsMock }))
vi.mock('@vercel/blob', () => ({ del: delMock }))

import { POST } from '@/app/api/admin/users/[id]/delete/route'
import { AuthorizationError } from '@/lib/authorization'

const PROVIDER_ID = '123e4567-e89b-12d3-a456-426614174000'
const COMPANY_NAME = 'Mustermann Bau GmbH'

function req(body: unknown) {
  return new NextRequest(`http://localhost/api/admin/users/${PROVIDER_ID}/delete`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

function baseUserRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: PROVIDER_ID,
    role: 'subunternehmer',
    company_name: COMPANY_NAME,
    subscription_status: 'inactive',
    deleted_at: null,
    ...overrides,
  }
}

describe('POST /api/admin/users/[id]/delete — Admin-Unternehmensverwaltung: Löschung/Anonymisierung', () => {
  beforeEach(() => {
    requireAdminApiMock.mockReset()
    requireAdminApiMock.mockResolvedValue({ id: 'admin-1' })
    queryMock.mockReset()
    queryMock.mockResolvedValue({ rows: [{ count: 0 }] }) // Rate-Limit
    clientQueryMock.mockReset()
    connectMock.mockReset()
    connectMock.mockResolvedValue({ query: clientQueryMock, release: releaseMock })
    releaseMock.mockReset()
    logAdminActionMock.mockReset()
    matchProviderAgainstOpenJobsMock.mockReset()
    matchProviderAgainstOpenJobsMock.mockResolvedValue({ providerId: PROVIDER_ID, resultCount: 0, eligibleCount: 0, excludedCount: 0 })
    delMock.mockReset()
    delMock.mockResolvedValue(undefined)
  })

  it('nicht angemeldeter/nicht-Admin-Nutzer erhält 403, keine Nebenwirkung', async () => {
    requireAdminApiMock.mockRejectedValue(new AuthorizationError('Kein Zugriff.'))
    const res = await POST(req({ confirmationName: COMPANY_NAME }), { params: Promise.resolve({ id: PROVIDER_ID }) })
    expect(res.status).toBe(403)
    expect(connectMock).not.toHaveBeenCalled()
    expect(logAdminActionMock).not.toHaveBeenCalled()
  })

  it('Unternehmen nicht gefunden -> 404', async () => {
    clientQueryMock.mockResolvedValueOnce({}) // BEGIN
    clientQueryMock.mockResolvedValueOnce({ rows: [] }) // SELECT ... FOR UPDATE
    const res = await POST(req({ confirmationName: COMPANY_NAME }), { params: Promise.resolve({ id: PROVIDER_ID }) })
    expect(res.status).toBe(404)
    expect(clientQueryMock).toHaveBeenCalledWith('ROLLBACK')
  })

  it('Zielkonto ist kein subunternehmer -> 400', async () => {
    clientQueryMock.mockResolvedValueOnce({}) // BEGIN
    clientQueryMock.mockResolvedValueOnce({ rows: [baseUserRow({ role: 'auftraggeber' })] })
    const res = await POST(req({ confirmationName: COMPANY_NAME }), { params: Promise.resolve({ id: PROVIDER_ID }) })
    expect(res.status).toBe(400)
  })

  it('falscher Bestätigungsname -> 400, keine Anonymisierung', async () => {
    clientQueryMock.mockResolvedValueOnce({}) // BEGIN
    clientQueryMock.mockResolvedValueOnce({ rows: [baseUserRow()] })
    const res = await POST(req({ confirmationName: 'Falscher Name' }), { params: Promise.resolve({ id: PROVIDER_ID }) })
    expect(res.status).toBe(400)
    const updateCall = clientQueryMock.mock.calls.find(([sql]) => typeof sql === 'string' && sql.includes('UPDATE users SET'))
    expect(updateCall).toBeUndefined()
    expect(clientQueryMock).toHaveBeenCalledWith('ROLLBACK')
  })

  it('fehlender confirmationName wird von Zod abgelehnt (400), bevor die Transaktion beginnt', async () => {
    const res = await POST(req({}), { params: Promise.resolve({ id: PROVIDER_ID }) })
    expect(res.status).toBe(400)
    expect(connectMock).not.toHaveBeenCalled()
  })

  it('aktives Abo -> 409, verständliche Fehlermeldung, kein Stripe-Aufruf', async () => {
    clientQueryMock.mockResolvedValueOnce({}) // BEGIN
    clientQueryMock.mockResolvedValueOnce({ rows: [baseUserRow({ subscription_status: 'active' })] })
    const res = await POST(req({ confirmationName: COMPANY_NAME }), { params: Promise.resolve({ id: PROVIDER_ID }) })
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toContain('Abonnement zuerst')
  })

  it('überfälliges (past_due) Abo -> ebenfalls 409', async () => {
    clientQueryMock.mockResolvedValueOnce({}) // BEGIN
    clientQueryMock.mockResolvedValueOnce({ rows: [baseUserRow({ subscription_status: 'past_due' })] })
    const res = await POST(req({ confirmationName: COMPANY_NAME }), { params: Promise.resolve({ id: PROVIDER_ID }) })
    expect(res.status).toBe(409)
  })

  it('canceled/inactive Abo: Löschung wird durchgeführt', async () => {
    clientQueryMock.mockImplementation((sql: string) => {
      if (sql.includes('SELECT id, role, company_name')) return Promise.resolve({ rows: [baseUserRow({ subscription_status: 'canceled' })] })
      if (sql.includes('SELECT pathname FROM private_files')) return Promise.resolve({ rows: [] })
      return Promise.resolve({ rows: [] })
    })
    const res = await POST(req({ confirmationName: COMPANY_NAME }), { params: Promise.resolve({ id: PROVIDER_ID }) })
    expect(res.status).toBe(200)
    expect(clientQueryMock).toHaveBeenCalledWith('COMMIT')
  })

  it('bereits gelöschtes Konto: idempotenter Erfolg (200, alreadyDeleted), keine erneute Nebenwirkung', async () => {
    clientQueryMock.mockResolvedValueOnce({}) // BEGIN
    clientQueryMock.mockResolvedValueOnce({ rows: [baseUserRow({ deleted_at: new Date().toISOString() })] })
    const res = await POST(req({ confirmationName: COMPANY_NAME }), { params: Promise.resolve({ id: PROVIDER_ID }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.alreadyDeleted).toBe(true)
    expect(logAdminActionMock).not.toHaveBeenCalled()
    expect(matchProviderAgainstOpenJobsMock).not.toHaveBeenCalled()
    const updateCall = clientQueryMock.mock.calls.find(([sql]) => typeof sql === 'string' && sql.includes('UPDATE users SET'))
    expect(updateCall).toBeUndefined()
  })

  it('bereits gelöschtes Konto + falscher Firmenname: 400 (Confirmation-Check gilt auch bei bereits gelöschten Konten), kein alreadyDeleted-Erfolg', async () => {
    clientQueryMock.mockResolvedValueOnce({}) // BEGIN
    clientQueryMock.mockResolvedValueOnce({ rows: [baseUserRow({ deleted_at: new Date().toISOString() })] })
    const res = await POST(req({ confirmationName: 'Falscher Name GmbH' }), { params: Promise.resolve({ id: PROVIDER_ID }) })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.alreadyDeleted).toBeUndefined()
    expect(logAdminActionMock).not.toHaveBeenCalled()
    expect(matchProviderAgainstOpenJobsMock).not.toHaveBeenCalled()
  })

  describe('erfolgreiche Anonymisierung — Details der UPDATE-Query', () => {
    beforeEach(() => {
      clientQueryMock.mockImplementation((sql: string) => {
        if (sql.includes('SELECT id, role, company_name')) return Promise.resolve({ rows: [baseUserRow({ subscription_status: 'canceled' })] })
        if (sql.includes('SELECT pathname FROM private_files')) return Promise.resolve({ rows: [{ pathname: 'private/qualification_file/p1/nachweis.pdf' }] })
        return Promise.resolve({ rows: [] })
      })
    })

    it('führt KEINE physische DELETE-Operation auf users durch', async () => {
      await POST(req({ confirmationName: COMPANY_NAME }), { params: Promise.resolve({ id: PROVIDER_ID }) })
      const deleteUsersCall = clientQueryMock.mock.calls.find(
        ([sql]) => typeof sql === 'string' && /DELETE\s+FROM\s+users/i.test(sql)
      )
      expect(deleteUsersCall).toBeUndefined()
    })

    it('setzt account_status=deleted, deleted_at, subscription_status=inactive, directory_listed=false, company_slug=NULL', async () => {
      await POST(req({ confirmationName: COMPANY_NAME }), { params: Promise.resolve({ id: PROVIDER_ID }) })
      const [sql] = clientQueryMock.mock.calls.find(([s]) => typeof s === 'string' && s.includes('UPDATE users SET'))!
      expect(sql).toContain("account_status = 'deleted'")
      expect(sql).toContain('deleted_at = now()')
      expect(sql).toContain("subscription_status = 'inactive'")
      expect(sql).toContain('directory_listed = false')
      expect(sql).toContain('company_slug = NULL')
      expect(sql).toContain('stripe_customer_id = NULL')
      expect(sql).toContain('stripe_subscription_id = NULL')
      expect(sql).toContain("gewerke = '{}'")
      expect(sql).toContain("verified_gewerke = '{}'")
      expect(sql).toContain("blocked_gewerke = '{}'")
      expect(sql).toContain("qualification_files = '[]'")
      expect(sql).toContain('phone = NULL')
      expect(sql).not.toContain('company_name')
    })

    it('anonymisiert die E-Mail auf ein eindeutiges deleted-*@deleted.invalid-Muster', async () => {
      await POST(req({ confirmationName: COMPANY_NAME }), { params: Promise.resolve({ id: PROVIDER_ID }) })
      const [, params] = clientQueryMock.mock.calls.find(([s]) => typeof s === 'string' && s.includes('UPDATE users SET'))!
      const anonymizedEmail = params[0] as string
      expect(anonymizedEmail).toMatch(/^deleted-[0-9a-f-]+@deleted\.invalid$/)
    })

    it('invalidiert password_hash mit einem echten, aber niemandem bekannten Hash (Login danach unmöglich)', async () => {
      await POST(req({ confirmationName: COMPANY_NAME }), { params: Promise.resolve({ id: PROVIDER_ID }) })
      const [, params] = clientQueryMock.mock.calls.find(([s]) => typeof s === 'string' && s.includes('UPDATE users SET'))!
      const passwordHash = params[1] as string
      expect(passwordHash).toBeTruthy()
      expect(passwordHash).not.toBe('')
    })

    it('löscht die private_files-Metadaten innerhalb derselben Transaktion', async () => {
      await POST(req({ confirmationName: COMPANY_NAME }), { params: Promise.resolve({ id: PROVIDER_ID }) })
      const deleteFilesCall = clientQueryMock.mock.calls.find(
        ([sql]) => typeof sql === 'string' && sql.includes("DELETE FROM private_files")
      )
      expect(deleteFilesCall).toBeDefined()
    })

    it('löscht die zugehörigen Blob-Objekte erst NACH dem Commit (best-effort)', async () => {
      await POST(req({ confirmationName: COMPANY_NAME }), { params: Promise.resolve({ id: PROVIDER_ID }) })
      expect(delMock).toHaveBeenCalledWith('private/qualification_file/p1/nachweis.pdf')
      const commitCallIndex = clientQueryMock.mock.calls.findIndex(([sql]) => sql === 'COMMIT')
      const commitOrder = clientQueryMock.mock.invocationCallOrder[commitCallIndex]
      const delOrder = delMock.mock.invocationCallOrder[0]
      expect(delOrder).toBeGreaterThan(commitOrder)
    })

    it('ein Fehler bei der Blob-Löschung lässt die bereits erfolgreiche Löschung erfolgreich zurückkehren', async () => {
      delMock.mockRejectedValueOnce(new Error('Blob-Storage down'))
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const res = await POST(req({ confirmationName: COMPANY_NAME }), { params: Promise.resolve({ id: PROVIDER_ID }) })
      expect(res.status).toBe(200)
      consoleErrorSpy.mockRestore()
    })

    it('protokolliert PROVIDER_DELETED im Admin-Audit-Log mit Firmenname, ohne Passwörter/Secrets', async () => {
      await POST(req({ confirmationName: COMPANY_NAME }), { params: Promise.resolve({ id: PROVIDER_ID }) })
      expect(logAdminActionMock).toHaveBeenCalledWith(
        'admin-1',
        'PROVIDER_DELETED',
        'user',
        PROVIDER_ID,
        expect.objectContaining({ companyName: COMPANY_NAME }),
        expect.anything()
      )
      const [, , , , metadata] = logAdminActionMock.mock.calls[0]
      expect(JSON.stringify(metadata)).not.toMatch(/password|hash|stripe_|secret/i)
    })

    it('löst Re-Matching aus (bestehende Matches werden über den Hard Filter invalidiert)', async () => {
      await POST(req({ confirmationName: COMPANY_NAME }), { params: Promise.resolve({ id: PROVIDER_ID }) })
      expect(matchProviderAgainstOpenJobsMock).toHaveBeenCalledWith(PROVIDER_ID)
    })

    it('ein Fehler im Re-Matching lässt die Löschung trotzdem erfolgreich zurückkehren (isoliert)', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      matchProviderAgainstOpenJobsMock.mockRejectedValueOnce(new Error('Matching-DB down'))
      const res = await POST(req({ confirmationName: COMPANY_NAME }), { params: Promise.resolve({ id: PROVIDER_ID }) })
      expect(res.status).toBe(200)
      consoleErrorSpy.mockRestore()
    })

    it('rührt keine offers/reviews/offer_messages/support_tickets/jobs/job_matches/match_notifications an', async () => {
      await POST(req({ confirmationName: COMPANY_NAME }), { params: Promise.resolve({ id: PROVIDER_ID }) })
      const touchedTables = clientQueryMock.mock.calls
        .map(([sql]) => (typeof sql === 'string' ? sql : ''))
        .filter((sql) =>
          /\b(offers|reviews|offer_messages|support_tickets|support_ticket_messages|jobs|job_matches|match_notifications|admin_audit_log)\b/i.test(
            sql
          )
        )
      expect(touchedTables).toEqual([])
    })
  })

  it('Race Condition: FOR UPDATE sperrt die Zeile für die Dauer der Transaktion', async () => {
    clientQueryMock.mockImplementation((sql: string) => {
      if (sql.includes('SELECT id, role, company_name')) {
        expect(sql).toContain('FOR UPDATE')
        return Promise.resolve({ rows: [baseUserRow({ subscription_status: 'canceled' })] })
      }
      return Promise.resolve({ rows: [] })
    })
    await POST(req({ confirmationName: COMPANY_NAME }), { params: Promise.resolve({ id: PROVIDER_ID }) })
  })

  it('Rate Limit: mehr als 10 Löschversuche pro Stunde werden abgelehnt (429)', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ count: 10 }] })
    const res = await POST(req({ confirmationName: COMPANY_NAME }), { params: Promise.resolve({ id: PROVIDER_ID }) })
    expect(res.status).toBe(429)
    expect(connectMock).not.toHaveBeenCalled()
  })

  it('ein Fehler während der Anonymisierung rollt die gesamte Transaktion zurück (kein halb gelöschter Account)', async () => {
    clientQueryMock.mockImplementation((sql: string) => {
      if (sql.includes('SELECT id, role, company_name')) return Promise.resolve({ rows: [baseUserRow({ subscription_status: 'canceled' })] })
      if (sql.includes('SELECT pathname FROM private_files')) return Promise.resolve({ rows: [] })
      if (sql.includes('UPDATE users SET')) throw new Error('DB-Fehler beim Schreiben')
      return Promise.resolve({ rows: [] })
    })
    const res = await POST(req({ confirmationName: COMPANY_NAME }), { params: Promise.resolve({ id: PROVIDER_ID }) })
    expect(res.status).toBe(500)
    expect(clientQueryMock).toHaveBeenCalledWith('ROLLBACK')
    expect(clientQueryMock).not.toHaveBeenCalledWith('COMMIT')
    expect(releaseMock).toHaveBeenCalled()
    expect(logAdminActionMock).not.toHaveBeenCalled()
  })
})
