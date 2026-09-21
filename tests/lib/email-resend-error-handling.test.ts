import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { emailsSendMock } = vi.hoisted(() => ({ emailsSendMock: vi.fn() }))
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({ emails: { send: emailsSendMock } })),
}))

import { sendMatchNotificationEmail, ResendSendError } from '@/lib/email'

const baseJob = {
  title: 'Testauftrag',
  gewerk: 'Elektro',
  plz: '10115',
  ort: 'Berlin',
  description: 'Testbeschreibung.',
  budgetMin: 1000,
  budgetMax: 2000,
  deadline: null,
}

describe('email.ts send() — Phase 3.6F Resend-Fehlerbehandlung', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    emailsSendMock.mockReset()
    process.env.RESEND_API_KEY = 'test_key'
    process.env.FROM_EMAIL = 'noreply@bauversus.de'
    process.env.NEXT_PUBLIC_APP_URL = 'https://bauversus.de'
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('wirft KEINEN Fehler bei erfolgreichem Versand (error: null)', async () => {
    emailsSendMock.mockResolvedValue({ data: { id: 'sent-1' }, error: null })
    await expect(sendMatchNotificationEmail('provider@example.com', baseJob)).resolves.toBeUndefined()
  })

  it('wirft einen ResendSendError mit dem exakten Fehlercode, wenn Resend { error } zurückgibt (bislang stillschweigend verschluckt)', async () => {
    emailsSendMock.mockResolvedValue({
      data: null,
      error: { message: 'Ungültige Absenderadresse', statusCode: 422, name: 'invalid_from_address' },
    })
    await expect(sendMatchNotificationEmail('provider@example.com', baseJob)).rejects.toMatchObject({
      message: 'Ungültige Absenderadresse',
      code: 'invalid_from_address',
    })
  })

  it('der geworfene Fehler ist eine echte Instanz von ResendSendError (für die Fehlerklassifizierung im Retry-System)', async () => {
    emailsSendMock.mockResolvedValue({
      data: null,
      error: { message: 'Rate limit erreicht', statusCode: 429, name: 'rate_limit_exceeded' },
    })
    try {
      await sendMatchNotificationEmail('provider@example.com', baseJob)
      expect.unreachable('sollte werfen')
    } catch (err) {
      expect(err).toBeInstanceOf(ResendSendError)
      expect((err as ResendSendError).code).toBe('rate_limit_exceeded')
    }
  })

  it('ohne konfigurierten RESEND_API_KEY: kein Resend-Aufruf, kein Fehler (bestehendes Dev-Verhalten unverändert)', async () => {
    delete process.env.RESEND_API_KEY
    await expect(sendMatchNotificationEmail('provider@example.com', baseJob)).resolves.toBeUndefined()
    expect(emailsSendMock).not.toHaveBeenCalled()
  })
})
