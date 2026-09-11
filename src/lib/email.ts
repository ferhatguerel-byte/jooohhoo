import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY || 're_build_placeholder')

export async function sendWelcomeEmail(to: string, name: string, plan: string, affiliateCode: string) {
  await resend.emails.send({
    from: process.env.FROM_EMAIL!,
    to,
    subject: '🎉 Willkommen! Dein Account ist aktiviert',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #7c3aed;">Willkommen, ${name}!</h1>
        <p>Dein <strong>${plan}</strong> Plan ist jetzt aktiv.</p>

        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>💰 Verdiene Geld mit uns!</h3>
          <p>Teile deinen persönlichen Affiliate-Link und verdiene <strong>30% Provision</strong> auf jeden Kauf:</p>
          <code style="background: #e5e7eb; padding: 8px 16px; border-radius: 4px; font-size: 16px;">
            ${process.env.NEXT_PUBLIC_APP_URL}/?ref=${affiliateCode}
          </code>
        </div>

        <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard"
           style="display: inline-block; background: #7c3aed; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 16px;">
          Zum Dashboard →
        </a>

        <p style="color: #6b7280; margin-top: 40px; font-size: 12px;">
          Bei Fragen: support@deinedomain.de
        </p>
      </div>
    `,
  })
}

export async function sendPaymentConfirmation(to: string, amount: number, plan: string) {
  await resend.emails.send({
    from: process.env.FROM_EMAIL!,
    to,
    subject: `✅ Zahlung bestätigt - ${plan} Plan`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #059669;">Zahlung bestätigt!</h1>
        <p>Wir haben deine Zahlung von <strong>€${amount}</strong> für den <strong>${plan}</strong> Plan erhalten.</p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard"
           style="display: inline-block; background: #059669; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 16px;">
          Jetzt starten →
        </a>
      </div>
    `,
  })
}

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

export async function sendAffiliateCommissionEmail(to: string, amount: number, referredEmail: string) {
  await resend.emails.send({
    from: process.env.FROM_EMAIL!,
    to,
    subject: `💰 Du hast €${amount} Provision verdient!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #7c3aed;">Glückwunsch! 🎉</h1>
        <p>${referredEmail} hat sich über deinen Affiliate-Link angemeldet.</p>
        <p>Du erhältst eine Provision von <strong>€${amount}</strong>.</p>
        <p>Diese wird am Ende des Monats auf dein Konto überwiesen.</p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/affiliate"
           style="display: inline-block; background: #7c3aed; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 16px;">
          Affiliate Dashboard →
        </a>
      </div>
    `,
  })
}
