import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Resend } from 'resend'

export async function POST(req: NextRequest) {
  const { leadIds, subject, body, fromName, fromEmail } = await req.json()

  const apiKey = db.getSetting('resend_api_key') || process.env.RESEND_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Kein Resend API-Key konfiguriert.' }, { status: 400 })
  }

  const resend = new Resend(apiKey)
  const from = fromEmail && fromName ? `${fromName} <${fromEmail}>` : (process.env.EMAIL_FROM || 'noreply@mail-leads.de')

  const results: { id: string; company: string; email: string; ok: boolean; error?: string }[] = []

  for (const leadId of leadIds) {
    const lead = db.getLead(leadId)
    if (!lead || !lead.email) {
      results.push({ id: leadId, company: String(lead?.company_name || leadId), email: '', ok: false, error: 'Keine E-Mail-Adresse' })
      continue
    }

    const personalizedBody = body
      .replace(/\{\{firma\}\}/gi, String(lead.company_name || ''))
      .replace(/\{\{ansprechpartner\}\}/gi, String(lead.contact_name || 'Sehr geehrte Damen und Herren'))
      .replace(/\{\{stadt\}\}/gi, String(lead.city || ''))
      .replace(/\{\{gewerk\}\}/gi, String(lead.gewerk || ''))

    const personalizedSubject = subject
      .replace(/\{\{firma\}\}/gi, String(lead.company_name || ''))
      .replace(/\{\{stadt\}\}/gi, String(lead.city || ''))

    try {
      await resend.emails.send({
        from,
        to: String(lead.email),
        subject: personalizedSubject,
        html: personalizedBody.replace(/\n/g, '<br>'),
      })

      db.updateLead(leadId, { email_sent: 1, email_sent_at: new Date().toISOString(), status: 'kontaktiert' })
      db.logEmail({ lead_id: leadId, subject: personalizedSubject, body: personalizedBody, status: 'sent' })
      results.push({ id: leadId, company: String(lead.company_name || ''), email: String(lead.email), ok: true })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      db.logEmail({ lead_id: leadId, subject: personalizedSubject, body: personalizedBody, status: 'error' })
      results.push({ id: leadId, company: String(lead.company_name || ''), email: String(lead.email), ok: false, error: msg })
    }

    await new Promise(r => setTimeout(r, 200))
  }

  const ok = results.filter(r => r.ok).length
  const failed = results.filter(r => !r.ok).length
  return NextResponse.json({ ok, failed, results })
}
