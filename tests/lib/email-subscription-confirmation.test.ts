import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { emailsSendMock } = vi.hoisted(() => ({ emailsSendMock: vi.fn().mockResolvedValue({ data: { id: 'sent-1' } }) }))
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({ emails: { send: emailsSendMock } })),
}))

import { sendSubscriptionConfirmationEmail } from '@/lib/email'

const baseInfo = {
  tierName: 'Monatspaket',
  priceEuroPerMonth: 119,
  billingNote: 'monatliche Abbuchung · jederzeit kündbar',
  minimumTermMonths: 0,
  committedUntil: null,
}

describe('sendSubscriptionConfirmationEmail — Phase 2B (manuelle Testkennzeichnung)', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    emailsSendMock.mockClear()
    process.env.RESEND_API_KEY = 'test_key'
    process.env.FROM_EMAIL = 'noreply@bauversus.de'
    process.env.NEXT_PUBLIC_APP_URL = 'https://bauversus.de'
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  describe('reguläre Vertragsbestätigung (isTest nicht gesetzt) — bleibt unverändert', () => {
    it('Betreff enthält KEIN Testpräfix', async () => {
      await sendSubscriptionConfirmationEmail('kunde@example.com', baseInfo)
      const payload = emailsSendMock.mock.calls[0][0]
      expect(payload.subject).toBe('Ihr BAUVERSUS-Abo (Monatspaket) wurde aktiviert')
      expect(payload.subject).not.toContain('TECHNISCHER TEST')
    })

    it('HTML und Text enthalten KEINEN Testhinweis', async () => {
      await sendSubscriptionConfirmationEmail('kunde@example.com', baseInfo)
      const payload = emailsSendMock.mock.calls[0][0]
      expect(payload.html).not.toContain('interner technischer Test')
      expect(payload.text).not.toContain('interner technischer Test')
    })

    it('enthält weiterhin Tarif, Preis und Abrechnungshinweis', async () => {
      await sendSubscriptionConfirmationEmail('kunde@example.com', baseInfo)
      const payload = emailsSendMock.mock.calls[0][0]
      expect(payload.html).toContain('Monatspaket')
      expect(payload.html).toContain('€119')
      expect(payload.html).toContain('monatliche Abbuchung')
    })

    it('explizit isTest: false verhält sich identisch zu isTest nicht gesetzt', async () => {
      await sendSubscriptionConfirmationEmail('kunde@example.com', { ...baseInfo, isTest: false })
      const payload = emailsSendMock.mock.calls[0][0]
      expect(payload.subject).toBe('Ihr BAUVERSUS-Abo (Monatspaket) wurde aktiviert')
      expect(payload.html).not.toContain('interner technischer Test')
    })

    it('Mindestlaufzeit-Zeile bleibt unverändert, wenn gesetzt', async () => {
      await sendSubscriptionConfirmationEmail('kunde@example.com', {
        ...baseInfo,
        minimumTermMonths: 12,
        committedUntil: '2027-01-01T00:00:00.000Z',
      })
      const payload = emailsSendMock.mock.calls[0][0]
      expect(payload.html).toContain('Mindestlaufzeit:')
      expect(payload.html).toContain('12 Monate')
    })
  })

  describe('Testmail (isTest: true) — eindeutig gekennzeichnet, kein echter Vertrag', () => {
    it('Betreff beginnt mit dem vorgeschriebenen Testpräfix', async () => {
      await sendSubscriptionConfirmationEmail('eigene-test-adresse@example.com', { ...baseInfo, isTest: true })
      const payload = emailsSendMock.mock.calls[0][0]
      expect(payload.subject.startsWith('[TECHNISCHER TEST – KEIN VERTRAG] ')).toBe(true)
    })

    it('HTML enthält den vorgeschriebenen, deutlich sichtbaren Testhinweis', async () => {
      await sendSubscriptionConfirmationEmail('eigene-test-adresse@example.com', { ...baseInfo, isTest: true })
      const payload = emailsSendMock.mock.calls[0][0]
      expect(payload.html).toContain(
        'Dies ist ein interner technischer Test der E-Mail-Zustellung. Es wurde kein Vertrag abgeschlossen oder verändert.'
      )
    })

    it('Text-Fallback enthält denselben Testhinweis', async () => {
      await sendSubscriptionConfirmationEmail('eigene-test-adresse@example.com', { ...baseInfo, isTest: true })
      const payload = emailsSendMock.mock.calls[0][0]
      expect(payload.text).toContain(
        'Dies ist ein interner technischer Test der E-Mail-Zustellung. Es wurde kein Vertrag abgeschlossen oder verändert.'
      )
    })

    it('der Testhinweis steht im HTML vor den eigentlichen Tarifdaten (sofort sichtbar, nicht erst nach Scrollen)', async () => {
      await sendSubscriptionConfirmationEmail('eigene-test-adresse@example.com', { ...baseInfo, isTest: true })
      const payload = emailsSendMock.mock.calls[0][0]
      const bannerIndex = payload.html.indexOf('interner technischer Test')
      const tarifIndex = payload.html.indexOf('<strong>Tarif:</strong>')
      expect(bannerIndex).toBeGreaterThan(-1)
      expect(bannerIndex).toBeLessThan(tarifIndex)
    })

    it('sendet weiterhin an genau den übergebenen Empfänger (keine Umleitung)', async () => {
      await sendSubscriptionConfirmationEmail('eigene-test-adresse@example.com', { ...baseInfo, isTest: true })
      const payload = emailsSendMock.mock.calls[0][0]
      expect(payload.to).toBe('eigene-test-adresse@example.com')
    })
  })
})
