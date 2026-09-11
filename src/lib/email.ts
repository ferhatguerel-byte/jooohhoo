import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY || 're_build_placeholder')

export async function sendQuoteRequestEmail(data: {
  name: string
  email: string
  telefon?: string
  leistung: string
  termin?: string
  nachricht?: string
}) {
  const notifyTo = process.env.QUOTE_NOTIFY_EMAIL || process.env.FROM_EMAIL!

  await resend.emails.send({
    from: process.env.FROM_EMAIL!,
    to: notifyTo,
    replyTo: data.email,
    subject: `📋 Neue Anfrage: ${data.leistung} – ${data.name}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #1e3a8a;">Neue Angebotsanfrage</h1>
        <table cellpadding="6" style="border-collapse: collapse;">
          <tr><td><strong>Name</strong></td><td>${data.name}</td></tr>
          <tr><td><strong>E-Mail</strong></td><td>${data.email}</td></tr>
          <tr><td><strong>Telefon</strong></td><td>${data.telefon || '–'}</td></tr>
          <tr><td><strong>Leistung</strong></td><td>${data.leistung}</td></tr>
          <tr><td><strong>Wunschtermin</strong></td><td>${data.termin || '–'}</td></tr>
        </table>
        <p><strong>Nachricht:</strong></p>
        <p>${(data.nachricht || '–').replace(/\n/g, '<br/>')}</p>
      </div>
    `,
  })
}
