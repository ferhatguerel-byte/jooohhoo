import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * Admin-Unternehmensverwaltung – Fortsetzung von tests/security/account-status-gate.test.ts für
 * die "Business"-Routen (Job-Erstellung/-Bearbeitung/-Vergabe/-Bewertung, KI-LV-Generierung,
 * Billing) sowie die gemeinsam von Nutzern UND Admins genutzten Support-Routen. Beweist, dass
 * requireActiveUserApi() jede dieser Routen VOR jedem DB-/Stripe-/KI-Zugriff abweist, sobald
 * account_status != 'active' ist – unabhängig davon, ob die Session vor oder nach der
 * Statusänderung durch den Admin angelegt wurde.
 */

const {
  getCurrentUserMock,
  queryMock,
  connectMock,
  clientQueryMock,
  releaseMock,
  generateLeistungsverzeichnisMock,
  stripeMock,
  getStripeMock,
} = vi.hoisted(() => ({
  getCurrentUserMock: vi.fn(),
  queryMock: vi.fn(),
  connectMock: vi.fn(),
  clientQueryMock: vi.fn(),
  releaseMock: vi.fn(),
  generateLeistungsverzeichnisMock: vi.fn(),
  stripeMock: {
    subscriptions: { update: vi.fn(), retrieve: vi.fn() },
    billingPortal: { sessions: { create: vi.fn() } },
    checkout: { sessions: { create: vi.fn() } },
    customers: { retrieve: vi.fn(), list: vi.fn(), create: vi.fn() },
  },
  getStripeMock: vi.fn(),
}))

vi.mock('@/lib/current-user', () => ({ getCurrentUser: getCurrentUserMock }))
vi.mock('@/lib/db', () => ({ getDb: () => ({ query: queryMock, connect: connectMock }) }))
vi.mock('@/lib/ai', () => ({ generateLeistungsverzeichnis: generateLeistungsverzeichnisMock }))
vi.mock('@/lib/stripe', () => ({ getStripe: getStripeMock }))
vi.mock('@/lib/email', () => ({ sendOfferAwardedEmail: vi.fn(), sendNewTicketEmail: vi.fn(), sendTicketReplyEmail: vi.fn() }))
vi.mock('@/lib/admin-audit', () => ({ logAdminAction: vi.fn() }))

import { POST as createJob } from '@/app/api/jobs/route'
import { PATCH as patchJob } from '@/app/api/jobs/[id]/route'
import { POST as awardJob } from '@/app/api/jobs/[id]/award/route'
import { POST as reviewJob } from '@/app/api/jobs/[id]/review/route'
import { POST as generateLv } from '@/app/api/jobs/generate-lv/route'
import { POST as checkout } from '@/app/api/billing/checkout/route'
import { POST as openPortal } from '@/app/api/billing/portal/route'
import { POST as cancelYearly, DELETE as undoCancelYearly } from '@/app/api/billing/cancel-yearly/route'
import { POST as postTicketMessage } from '@/app/api/support/tickets/[id]/messages/route'
import { POST as setTicketStatus } from '@/app/api/support/tickets/[id]/status/route'

function jsonReq(url: string, body: unknown, method = 'POST') {
  return new NextRequest(url, { method, body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })
}

const auftraggeber = (accountStatus: 'active' | 'suspended' | 'deleted') => ({
  id: 'ag-1',
  role: 'auftraggeber' as const,
  accountStatus,
  email: 'ag@example.com',
})

const subunternehmer = (accountStatus: 'active' | 'suspended' | 'deleted', overrides: Record<string, unknown> = {}) => ({
  id: 'sub-1',
  role: 'subunternehmer' as const,
  accountStatus,
  email: 'sub@example.com',
  stripeCustomerId: 'cus_1',
  stripeSubscriptionId: 'sub_stripe_1',
  subscriptionCommittedUntil: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString(),
  subscriptionTier: 'monthly',
  ...overrides,
})

beforeEach(() => {
  getCurrentUserMock.mockReset()
  queryMock.mockReset()
  queryMock.mockResolvedValue({ rows: [{ count: 0 }] })
  connectMock.mockReset()
  clientQueryMock.mockReset()
  releaseMock.mockReset()
  connectMock.mockResolvedValue({ query: clientQueryMock, release: releaseMock })
  clientQueryMock.mockResolvedValue({ rows: [] })
  generateLeistungsverzeichnisMock.mockReset()
  getStripeMock.mockReset()
  getStripeMock.mockReturnValue(stripeMock)
  Object.values(stripeMock.subscriptions).forEach((fn) => (fn as ReturnType<typeof vi.fn>).mockReset())
  Object.values(stripeMock.billingPortal.sessions).forEach((fn) => (fn as ReturnType<typeof vi.fn>).mockReset())
  Object.values(stripeMock.checkout.sessions).forEach((fn) => (fn as ReturnType<typeof vi.fn>).mockReset())
  Object.values(stripeMock.customers).forEach((fn) => (fn as ReturnType<typeof vi.fn>).mockReset())
})

describe('Admin-Unternehmensverwaltung – requireActiveUserApi() sichert Business-/Billing-Routen ab', () => {
  describe('POST /api/jobs (neuen Auftrag erzeugen — explizit "keine neuen Projekte" aus der Spezifikation)', () => {
    it('SUSPENDED: kein neuer Auftrag wird erzeugt, keine Rate-Limit-/DB-Abfrage', async () => {
      getCurrentUserMock.mockResolvedValue(auftraggeber('suspended'))
      const res = await createJob(
        jsonReq('http://localhost/api/jobs', {
          title: 'Neubau Dach',
          gewerk: 'Dachdecker',
          plz: '10115',
          ort: 'Berlin',
          description: 'x'.repeat(30),
        })
      )
      expect(res.status).toBe(403)
      expect(connectMock).not.toHaveBeenCalled()
    })

    it('DELETED: kein neuer Auftrag wird erzeugt', async () => {
      getCurrentUserMock.mockResolvedValue(auftraggeber('deleted'))
      const res = await createJob(
        jsonReq('http://localhost/api/jobs', {
          title: 'Neubau Dach',
          gewerk: 'Dachdecker',
          plz: '10115',
          ort: 'Berlin',
          description: 'x'.repeat(30),
        })
      )
      expect(res.status).toBe(403)
      expect(connectMock).not.toHaveBeenCalled()
    })
  })

  describe('PATCH /api/jobs/[id] (Auftrag bearbeiten)', () => {
    it('SUSPENDED: keine Bearbeitung möglich', async () => {
      getCurrentUserMock.mockResolvedValue(auftraggeber('suspended'))
      const res = await patchJob(
        jsonReq('http://localhost/api/jobs/job-1', { title: 'x'.repeat(10), description: 'x'.repeat(30) }, 'PATCH'),
        { params: Promise.resolve({ id: 'job-1' }) }
      )
      expect(res.status).toBe(403)
      expect(queryMock).not.toHaveBeenCalled()
    })
  })

  describe('POST /api/jobs/[id]/award (Auftrag vergeben)', () => {
    it('SUSPENDED: keine Vergabe möglich, kein Transaktionsstart', async () => {
      getCurrentUserMock.mockResolvedValue(auftraggeber('suspended'))
      const res = await awardJob(jsonReq('http://localhost/api/jobs/job-1/award', { offerId: '123e4567-e89b-12d3-a456-426614174000' }), {
        params: Promise.resolve({ id: 'job-1' }),
      })
      expect(res.status).toBe(403)
      expect(connectMock).not.toHaveBeenCalled()
    })
  })

  describe('POST /api/jobs/[id]/review (Bewertung abgeben)', () => {
    it('SUSPENDED: keine neue Bewertung', async () => {
      getCurrentUserMock.mockResolvedValue(auftraggeber('suspended'))
      const res = await reviewJob(jsonReq('http://localhost/api/jobs/job-1/review', { rating: 5 }), {
        params: Promise.resolve({ id: 'job-1' }),
      })
      expect(res.status).toBe(403)
      expect(queryMock).not.toHaveBeenCalled()
    })
  })

  describe('POST /api/jobs/generate-lv (kostenpflichtige KI-Generierung)', () => {
    it('SUSPENDED: kein KI-Aufruf', async () => {
      getCurrentUserMock.mockResolvedValue(auftraggeber('suspended'))
      const res = await generateLv(jsonReq('http://localhost/api/jobs/generate-lv', { description: 'x'.repeat(25) }))
      expect(res.status).toBe(403)
      expect(generateLeistungsverzeichnisMock).not.toHaveBeenCalled()
    })
  })

  describe('POST /api/billing/checkout (neues Abo abschließen)', () => {
    it('DELETED: kein neues Abo — verhindert Selbst-Reaktivierung ohne Admin', async () => {
      getCurrentUserMock.mockResolvedValue(subunternehmer('deleted'))
      const res = await checkout(jsonReq('http://localhost/api/billing/checkout', { tier: 'monthly' }))
      expect(res.status).toBe(403)
      expect(stripeMock.checkout.sessions.create).not.toHaveBeenCalled()
    })

    it('SUSPENDED: kein neues Abo', async () => {
      getCurrentUserMock.mockResolvedValue(subunternehmer('suspended'))
      const res = await checkout(jsonReq('http://localhost/api/billing/checkout', { tier: 'monthly' }))
      expect(res.status).toBe(403)
      expect(stripeMock.checkout.sessions.create).not.toHaveBeenCalled()
    })
  })

  describe('POST /api/billing/portal (Stripe-Kundenportal öffnen)', () => {
    it('SUSPENDED: kein Portal-Zugriff', async () => {
      getCurrentUserMock.mockResolvedValue(subunternehmer('suspended'))
      const res = await openPortal(jsonReq('http://localhost/api/billing/portal', {}))
      expect(res.status).toBe(403)
      expect(stripeMock.billingPortal.sessions.create).not.toHaveBeenCalled()
    })
  })

  describe('POST/DELETE /api/billing/cancel-yearly (eigene Stripe-Kündigung verwalten)', () => {
    it('ACTIVE: Kündigung funktioniert weiterhin wie vorher (kein pre-existing Test für den Happy-Path vorhanden)', async () => {
      getCurrentUserMock.mockResolvedValue(subunternehmer('active'))
      stripeMock.subscriptions.update.mockResolvedValue({})
      const res = await cancelYearly()
      expect(res.status).toBe(200)
      expect(stripeMock.subscriptions.update).toHaveBeenCalledWith('sub_stripe_1', expect.objectContaining({ cancel_at: expect.any(Number) }))
    })

    it('SUSPENDED: keine Kündigung einreichen', async () => {
      getCurrentUserMock.mockResolvedValue(subunternehmer('suspended'))
      const res = await cancelYearly()
      expect(res.status).toBe(403)
      expect(stripeMock.subscriptions.update).not.toHaveBeenCalled()
    })

    it('DELETED: keine Kündigung zurückziehen', async () => {
      getCurrentUserMock.mockResolvedValue(subunternehmer('deleted'))
      const res = await undoCancelYearly()
      expect(res.status).toBe(403)
      expect(stripeMock.subscriptions.update).not.toHaveBeenCalled()
    })
  })

  describe('POST /api/support/tickets/[id]/messages (geteilt zwischen Nutzer und Admin)', () => {
    it('SUSPENDED (normaler Nutzer): keine neue Nachricht', async () => {
      getCurrentUserMock.mockResolvedValue(auftraggeber('suspended'))
      const res = await postTicketMessage(jsonReq('http://localhost/api/support/tickets/t1/messages', { message: 'Hallo' }), {
        params: Promise.resolve({ id: 't1' }),
      })
      expect(res.status).toBe(403)
      expect(queryMock).not.toHaveBeenCalled()
    })

    it('Admin bleibt funktionsfähig, selbst wenn sein eigener accountStatus theoretisch suspended wäre', async () => {
      vi.stubEnv('ADMIN_EMAIL', 'admin@example.com')
      getCurrentUserMock.mockResolvedValue({ id: 'admin-1', email: 'admin@example.com', role: 'auftraggeber', accountStatus: 'suspended' })
      queryMock.mockImplementation(async (sql: string) => {
        if (sql.includes('rate_limit_hits')) return { rows: [{ count: 0 }] }
        if (sql.includes('SELECT t.id')) {
          return { rows: [{ id: 't1', user_id: 'someone-else', status: 'open', subject: 'x', email: 'x@example.com', email_notifications: false }] }
        }
        return { rows: [] }
      })
      const res = await postTicketMessage(jsonReq('http://localhost/api/support/tickets/t1/messages', { message: 'Admin-Antwort' }), {
        params: Promise.resolve({ id: 't1' }),
      })
      expect(res.status).toBe(200)
    })
  })

  describe('POST /api/support/tickets/[id]/status', () => {
    it('SUSPENDED (normaler Nutzer): kein Status-Wechsel', async () => {
      getCurrentUserMock.mockResolvedValue(auftraggeber('suspended'))
      const res = await setTicketStatus(jsonReq('http://localhost/api/support/tickets/t1/status', { status: 'closed' }), {
        params: Promise.resolve({ id: 't1' }),
      })
      expect(res.status).toBe(403)
      expect(queryMock).not.toHaveBeenCalled()
    })
  })
})
