import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * Admin-Unternehmensverwaltung – Security-Review-Fund: eine bereits bestehende, noch gültige
 * Session eines gesperrten (`suspended`) oder gelöschten (`deleted`) Kontos konnte bislang
 * mehrere mutierende API-Routen weiterhin aufrufen, obwohl Login und das Dashboard-UI den
 * Zugriff bereits blockierten. Dieser Test simuliert exakt das im Review beschriebene Szenario
 * ("1. User loggt sich ein. 2. Session bleibt bestehen. 3. Admin setzt account_status =
 * suspended/deleted. 4. Derselbe Session-Cookie ruft API auf. 5. Mutierende Route muss
 * abgewiesen werden.") für jede jetzt über requireActiveUserApi() abgesicherte Route.
 *
 * getCurrentUser() wird direkt gemockt (nicht die Session/Cookies selbst) – das ist innerhalb
 * eines Requests exakt der Zustand, den eine bereits bestehende Session nach einer
 * Statusänderung durch den Admin hätte: derselbe Session-Cookie liefert beim nächsten Request
 * einen frisch aus der DB geladenen Nutzer mit dem NEUEN accountStatus, ohne dass sich am
 * Cookie/Token selbst etwas geändert hätte.
 */

const {
  getCurrentUserMock,
  queryMock,
  connectMock,
  clientQueryMock,
  releaseMock,
  putMock,
  optimizeMock,
  sendNewTicketEmailMock,
} = vi.hoisted(() => ({
  getCurrentUserMock: vi.fn(),
  queryMock: vi.fn(),
  connectMock: vi.fn(),
  clientQueryMock: vi.fn(),
  releaseMock: vi.fn(),
  putMock: vi.fn(),
  optimizeMock: vi.fn(),
  sendNewTicketEmailMock: vi.fn(),
}))

vi.mock('@/lib/current-user', () => ({ getCurrentUser: getCurrentUserMock }))
vi.mock('@/lib/db', () => ({ getDb: () => ({ query: queryMock, connect: connectMock }) }))
vi.mock('@vercel/blob', () => ({ put: putMock }))
vi.mock('@/lib/image-optimize', () => ({ optimizeImageIfNeeded: optimizeMock }))
vi.mock('@/lib/email', () => ({ sendNewTicketEmail: sendNewTicketEmailMock, sendTicketReplyEmail: vi.fn() }))
vi.mock('@/lib/auth', () => ({
  hashPassword: vi.fn(async (p: string) => `hashed:${p}`),
  verifyPassword: vi.fn(async () => true),
}))
vi.mock('@/lib/matching/run-provider-matching', () => ({ matchProviderAgainstOpenJobs: vi.fn() }))

import { POST as updateProfile } from '@/app/api/profile/route'
import { POST as setDirectoryListing } from '@/app/api/account/directory-listing/route'
import { POST as changePassword } from '@/app/api/account/password/route'
import { POST as changeEmail } from '@/app/api/account/email/route'
import { POST as updateNotifications } from '@/app/api/account/notifications/route'
import { POST as uploadFile } from '@/app/api/upload/route'
import { POST as hideJob, DELETE as unhideJob } from '@/app/api/jobs/[id]/hide/route'
import { POST as createSupportTicket } from '@/app/api/support/tickets/route'

function jsonReq(url: string, body: unknown, method = 'POST') {
  return new NextRequest(url, { method, body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })
}

const subunternehmer = (accountStatus: 'active' | 'suspended' | 'deleted') => ({
  id: 'sub-1',
  role: 'subunternehmer' as const,
  accountStatus,
  verificationStatus: 'unverified' as const,
  blockedGewerke: [] as string[],
  qualificationFiles: [] as { fileId: string; name: string; label: string }[],
  gewerke: [] as string[],
  serviceRadiusKm: null,
  minProjectSize: null,
  maxProjectSize: null,
  companyName: 'Musterbau GmbH',
})

beforeEach(() => {
  getCurrentUserMock.mockReset()
  queryMock.mockReset()
  queryMock.mockResolvedValue({ rows: [{ count: 0, password_hash: 'h' }] })
  connectMock.mockReset()
  clientQueryMock.mockReset()
  releaseMock.mockReset()
  connectMock.mockResolvedValue({ query: clientQueryMock, release: releaseMock })
  clientQueryMock.mockResolvedValue({ rows: [{ id: 'ticket-1' }] })
  putMock.mockReset()
  putMock.mockResolvedValue({ pathname: 'private/qualification_file/sub-1/file.pdf' })
  optimizeMock.mockReset()
  optimizeMock.mockImplementation(async (file: File) => ({
    buffer: Buffer.from(await file.arrayBuffer()),
    contentType: file.type,
  }))
  sendNewTicketEmailMock.mockReset()
  vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'test-token')
})

describe('Admin-Unternehmensverwaltung – requireActiveUserApi() sichert mutierende Routen gegen bestehende Sessions gesperrter/gelöschter Konten ab', () => {
  describe('POST /api/profile', () => {
    const body = { companyName: 'Neuer Name GmbH', plz: '10115', ort: 'Berlin' }

    it('ACTIVE: funktioniert wie vorher', async () => {
      getCurrentUserMock.mockResolvedValue(subunternehmer('active'))
      const res = await updateProfile(jsonReq('http://localhost/api/profile', body))
      expect(res.status).toBe(200)
    })

    it('SUSPENDED: wird abgewiesen, kein UPDATE auf company_name', async () => {
      getCurrentUserMock.mockResolvedValue(subunternehmer('suspended'))
      const res = await updateProfile(jsonReq('http://localhost/api/profile', body))
      expect(res.status).toBe(403)
      expect(queryMock).not.toHaveBeenCalledWith(expect.stringContaining('UPDATE users SET company_name'), expect.anything())
    })

    it('DELETED: wird abgewiesen, kein UPDATE auf company_name (Kernfund des Reviews)', async () => {
      getCurrentUserMock.mockResolvedValue(subunternehmer('deleted'))
      const res = await updateProfile(jsonReq('http://localhost/api/profile', body))
      expect(res.status).toBe(403)
      expect(queryMock).not.toHaveBeenCalledWith(expect.stringContaining('UPDATE users SET company_name'), expect.anything())
    })

    it('EXISTING SESSION: Admin sperrt das Konto NACH dem Login – derselbe Session-Cookie kann company_name danach nicht mehr ändern', async () => {
      // Schritt 1+2: Login, Session besteht (aktiver Zustand).
      getCurrentUserMock.mockResolvedValue(subunternehmer('active'))
      const before = await updateProfile(jsonReq('http://localhost/api/profile', body))
      expect(before.status).toBe(200)

      // Schritt 3: Admin setzt account_status=suspended (simuliert durch denselben Mock, der beim
      // nächsten Request den neuen DB-Zustand liefert – exakt das Verhalten von getCurrentUser()
      // nach einer Statusänderung durch den Admin, ohne dass sich am Session-Cookie etwas ändert).
      getCurrentUserMock.mockResolvedValue(subunternehmer('suspended'))

      // Schritt 4+5: derselbe (weiterhin gültige) Session-Cookie ruft dieselbe Route erneut auf.
      const after = await updateProfile(jsonReq('http://localhost/api/profile', { ...body, companyName: 'Übernommen GmbH' }))
      expect(after.status).toBe(403)
    })
  })

  describe('POST /api/account/directory-listing', () => {
    it('ACTIVE: funktioniert wie vorher', async () => {
      getCurrentUserMock.mockResolvedValue(subunternehmer('active'))
      const res = await setDirectoryListing(jsonReq('http://localhost/api/account/directory-listing', { listed: true }))
      expect(res.status).toBe(200)
    })

    it('SUSPENDED: wird abgewiesen, keine DB-Änderung', async () => {
      getCurrentUserMock.mockResolvedValue(subunternehmer('suspended'))
      const res = await setDirectoryListing(jsonReq('http://localhost/api/account/directory-listing', { listed: true }))
      expect(res.status).toBe(403)
      expect(queryMock).not.toHaveBeenCalled()
    })

    it('DELETED: wird abgewiesen, keine DB-Änderung', async () => {
      getCurrentUserMock.mockResolvedValue(subunternehmer('deleted'))
      const res = await setDirectoryListing(jsonReq('http://localhost/api/account/directory-listing', { listed: true }))
      expect(res.status).toBe(403)
      expect(queryMock).not.toHaveBeenCalled()
    })
  })

  describe('POST /api/account/password', () => {
    const body = { currentPassword: 'altesPasswort123', newPassword: 'neuesPasswort123' }

    it('ACTIVE: funktioniert wie vorher', async () => {
      getCurrentUserMock.mockResolvedValue(subunternehmer('active'))
      const res = await changePassword(jsonReq('http://localhost/api/account/password', body))
      expect(res.status).toBe(200)
    })

    it('SUSPENDED: wird abgewiesen, kein neues Passwort gesetzt', async () => {
      getCurrentUserMock.mockResolvedValue(subunternehmer('suspended'))
      const res = await changePassword(jsonReq('http://localhost/api/account/password', body))
      expect(res.status).toBe(403)
      expect(queryMock).not.toHaveBeenCalled()
    })

    it('DELETED: ein gelöschtes Konto darf sein Passwort nicht mehr ändern', async () => {
      getCurrentUserMock.mockResolvedValue(subunternehmer('deleted'))
      const res = await changePassword(jsonReq('http://localhost/api/account/password', body))
      expect(res.status).toBe(403)
      expect(queryMock).not.toHaveBeenCalled()
    })
  })

  describe('POST /api/account/email', () => {
    const body = { newEmail: 'neu@example.com', currentPassword: 'passwort123' }

    it('ACTIVE: funktioniert wie vorher', async () => {
      getCurrentUserMock.mockResolvedValue(subunternehmer('active'))
      queryMock.mockImplementation(async (sql: string) => {
        if (sql.includes('password_hash')) return { rows: [{ password_hash: 'h' }] }
        return { rows: [] }
      })
      const res = await changeEmail(jsonReq('http://localhost/api/account/email', body))
      expect(res.status).toBe(200)
    })

    it('SUSPENDED: wird abgewiesen, keine neue E-Mail gesetzt', async () => {
      getCurrentUserMock.mockResolvedValue(subunternehmer('suspended'))
      const res = await changeEmail(jsonReq('http://localhost/api/account/email', body))
      expect(res.status).toBe(403)
      expect(queryMock).not.toHaveBeenCalled()
    })

    it('DELETED: ein gelöschtes Konto darf seine E-Mail-Adresse nicht mehr ändern', async () => {
      getCurrentUserMock.mockResolvedValue(subunternehmer('deleted'))
      const res = await changeEmail(jsonReq('http://localhost/api/account/email', body))
      expect(res.status).toBe(403)
      expect(queryMock).not.toHaveBeenCalled()
    })
  })

  describe('POST /api/account/notifications', () => {
    const body = { emailNotifications: false, newsletterOptIn: false }

    it('ACTIVE: funktioniert wie vorher', async () => {
      getCurrentUserMock.mockResolvedValue(subunternehmer('active'))
      const res = await updateNotifications(jsonReq('http://localhost/api/account/notifications', body))
      expect(res.status).toBe(200)
    })

    it('SUSPENDED: wird abgewiesen', async () => {
      getCurrentUserMock.mockResolvedValue(subunternehmer('suspended'))
      const res = await updateNotifications(jsonReq('http://localhost/api/account/notifications', body))
      expect(res.status).toBe(403)
      expect(queryMock).not.toHaveBeenCalled()
    })

    it('DELETED: wird abgewiesen', async () => {
      getCurrentUserMock.mockResolvedValue(subunternehmer('deleted'))
      const res = await updateNotifications(jsonReq('http://localhost/api/account/notifications', body))
      expect(res.status).toBe(403)
      expect(queryMock).not.toHaveBeenCalled()
    })
  })

  describe('POST /api/upload', () => {
    function reqWithFile() {
      const formData = new FormData()
      formData.set('file', new File(['%PDF-1.4'], 'nachweis.pdf', { type: 'application/pdf' }))
      formData.set('purpose', 'qualification_file')
      return new NextRequest('http://localhost/api/upload', { method: 'POST', body: formData })
    }

    it('ACTIVE: funktioniert wie vorher', async () => {
      getCurrentUserMock.mockResolvedValue(subunternehmer('active'))
      queryMock.mockImplementation(async (sql: string) => {
        if (sql.includes('INSERT INTO private_files')) return { rows: [{ id: 'file-1' }] }
        return { rows: [{ count: 0 }] }
      })
      const res = await uploadFile(reqWithFile())
      expect(res.status).toBe(200)
    })

    it('SUSPENDED: keine neue Datei wird gespeichert', async () => {
      getCurrentUserMock.mockResolvedValue(subunternehmer('suspended'))
      const res = await uploadFile(reqWithFile())
      expect(res.status).toBe(403)
      expect(putMock).not.toHaveBeenCalled()
      expect(queryMock).not.toHaveBeenCalled()
    })

    it('DELETED: keine neue Datei wird gespeichert', async () => {
      getCurrentUserMock.mockResolvedValue(subunternehmer('deleted'))
      const res = await uploadFile(reqWithFile())
      expect(res.status).toBe(403)
      expect(putMock).not.toHaveBeenCalled()
      expect(queryMock).not.toHaveBeenCalled()
    })
  })

  describe('POST/DELETE /api/jobs/[id]/hide', () => {
    it('ACTIVE: Hide funktioniert wie vorher', async () => {
      getCurrentUserMock.mockResolvedValue(subunternehmer('active'))
      const res = await hideJob(jsonReq('http://localhost/api/jobs/job-1/hide', {}), { params: Promise.resolve({ id: 'job-1' }) })
      expect(res.status).toBe(200)
    })

    it('SUSPENDED: Hide wird abgewiesen, kein INSERT', async () => {
      getCurrentUserMock.mockResolvedValue(subunternehmer('suspended'))
      const res = await hideJob(jsonReq('http://localhost/api/jobs/job-1/hide', {}), { params: Promise.resolve({ id: 'job-1' }) })
      expect(res.status).toBe(403)
      expect(queryMock).not.toHaveBeenCalled()
    })

    it('DELETED: Unhide (DELETE) wird ebenfalls abgewiesen, kein DELETE-Statement', async () => {
      getCurrentUserMock.mockResolvedValue(subunternehmer('deleted'))
      const res = await unhideJob(jsonReq('http://localhost/api/jobs/job-1/hide', {}, 'DELETE'), {
        params: Promise.resolve({ id: 'job-1' }),
      })
      expect(res.status).toBe(403)
      expect(queryMock).not.toHaveBeenCalled()
    })
  })

  describe('POST /api/support/tickets (Erstellung) vs. GET (Lesen)', () => {
    const body = { category: 'Sonstiges', subject: 'Hilfe', message: 'Bitte um Unterstützung.' }

    it('ACTIVE: Ticket-Erstellung funktioniert wie vorher', async () => {
      getCurrentUserMock.mockResolvedValue(subunternehmer('active'))
      const res = await createSupportTicket(jsonReq('http://localhost/api/support/tickets', body))
      expect(res.status).toBe(200)
    })

    it('SUSPENDED: kein neues Support-Ticket, kein DB-Write', async () => {
      getCurrentUserMock.mockResolvedValue(subunternehmer('suspended'))
      const res = await createSupportTicket(jsonReq('http://localhost/api/support/tickets', body))
      expect(res.status).toBe(403)
      expect(connectMock).not.toHaveBeenCalled()
      expect(sendNewTicketEmailMock).not.toHaveBeenCalled()
    })

    it('DELETED: kein neues Support-Ticket, kein DB-Write', async () => {
      getCurrentUserMock.mockResolvedValue(subunternehmer('deleted'))
      const res = await createSupportTicket(jsonReq('http://localhost/api/support/tickets', body))
      expect(res.status).toBe(403)
      expect(connectMock).not.toHaveBeenCalled()
      expect(sendNewTicketEmailMock).not.toHaveBeenCalled()
    })
  })
})
