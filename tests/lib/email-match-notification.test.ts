import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { emailsSendMock } = vi.hoisted(() => ({ emailsSendMock: vi.fn().mockResolvedValue({ data: { id: 'sent-1' } }) }))
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({ emails: { send: emailsSendMock } })),
}))

import { sendMatchNotificationEmail } from '@/lib/email'

const baseJob = {
  title: 'Badezimmer komplett sanieren',
  gewerk: 'Elektro',
  plz: '10115',
  ort: 'Berlin',
  description: 'Komplettsanierung eines Badezimmers in einer Altbauwohnung, inkl. Elektrik.',
  budgetMin: 5000,
  budgetMax: 10000,
  deadline: null,
}

describe('sendMatchNotificationEmail — Phase 3.6D Inhalt & PII', () => {
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

  it('E14: enthält Job-Titel, Gewerk, PLZ/Ort und eine klare CTA', async () => {
    await sendMatchNotificationEmail('provider@example.com', baseJob)
    const payload = emailsSendMock.mock.calls[0][0]
    expect(payload.html).toContain('Badezimmer komplett sanieren')
    expect(payload.html).toContain('Elektro')
    expect(payload.html).toContain('10115')
    expect(payload.html).toContain('Berlin')
    expect(payload.html).toContain('Auftrag ansehen')
  })

  it('F16/F17: CTA verweist auf die tatsächlich existierende Route /dashboard/jobs, basierend auf NEXT_PUBLIC_APP_URL', async () => {
    await sendMatchNotificationEmail('provider@example.com', baseJob)
    const payload = emailsSendMock.mock.calls[0][0]
    expect(payload.html).toContain('https://bauversus.de/dashboard/jobs')
  })

  it('sendet an genau den übergebenen Empfänger, mit Betreff und Absender aus der zentralen Konfiguration', async () => {
    await sendMatchNotificationEmail('provider@example.com', baseJob)
    const payload = emailsSendMock.mock.calls[0][0]
    expect(payload.to).toBe('provider@example.com')
    expect(payload.from).toBe('noreply@bauversus.de')
    expect(payload.subject).toContain('Badezimmer komplett sanieren')
  })

  it('enthält einen Plain-Text-Teil (falls von der Infrastruktur unterstützt)', async () => {
    await sendMatchNotificationEmail('provider@example.com', baseJob)
    const payload = emailsSendMock.mock.calls[0][0]
    expect(typeof payload.text).toBe('string')
    expect(payload.text).toContain('Badezimmer komplett sanieren')
  })

  it('E15: enthält NICHT den internen Match-Score als Zahl ("87" o.ä. als Punktzahl-Kommunikation)', async () => {
    await sendMatchNotificationEmail('provider@example.com', baseJob)
    const payload = emailsSendMock.mock.calls[0][0]
    expect(payload.html).not.toMatch(/\d{1,3}\s*(Punkte|\/100|%)/i)
    expect(payload.html).not.toMatch(/score/i)
  })

  it('E15: enthält keine Auftraggeber-Kontaktdaten, keine internen IDs, keine missing_data/Score-Breakdown-Begriffe', async () => {
    await sendMatchNotificationEmail('provider@example.com', baseJob)
    const payload = emailsSendMock.mock.calls[0][0]
    const fullText = `${payload.html} ${payload.text}`
    expect(fullText).not.toMatch(/@(?!bauversus)/i) // keine zweite E-Mail-Adresse außer dem Absender
    expect(fullText).not.toMatch(/Telefon|Tel\.|\+49/)
    expect(fullText).not.toMatch(/missing_data|matched_factors|exclusion_reason/i)
    expect(fullText).not.toMatch(/Auftraggeber(name)?:/i)
  })

  it('kürzt eine sehr lange Projektbeschreibung statt sie unbegrenzt zu übernehmen', async () => {
    const longDescription = 'A'.repeat(2000)
    await sendMatchNotificationEmail('provider@example.com', { ...baseJob, description: longDescription })
    const payload = emailsSendMock.mock.calls[0][0]
    expect(payload.html.length).toBeLessThan(longDescription.length + 3000)
    expect(payload.html).toContain('…')
  })

  it('escaped HTML-Zeichen in der Beschreibung (kein HTML-Injection)', async () => {
    await sendMatchNotificationEmail('provider@example.com', {
      ...baseJob,
      description: '<img src=x onerror=alert(1)> gefährlicher Text',
    })
    const payload = emailsSendMock.mock.calls[0][0]
    expect(payload.html).not.toContain('<img src=x onerror=alert(1)>')
    expect(payload.html).toContain('&lt;img')
  })

  it('lässt Budget/Deadline-Zeilen weg, wenn die Felder NULL sind (keine erfundenen Werte)', async () => {
    await sendMatchNotificationEmail('provider@example.com', { ...baseJob, budgetMin: null, budgetMax: null, deadline: null })
    const payload = emailsSendMock.mock.calls[0][0]
    expect(payload.html).not.toContain('Budget:')
    expect(payload.html).not.toContain('Gewünschter Termin:')
  })

  it('zeigt Budget/Deadline, wenn vorhanden', async () => {
    await sendMatchNotificationEmail('provider@example.com', { ...baseJob, deadline: '2026-06-01' })
    const payload = emailsSendMock.mock.calls[0][0]
    expect(payload.html).toContain('Budget:')
    expect(payload.html).toContain('Gewünschter Termin:')
  })
})
