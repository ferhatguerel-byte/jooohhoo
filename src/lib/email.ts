import { Resend } from 'resend'

function getResend() {
  return new Resend(process.env.RESEND_API_KEY)
}

export async function sendWelcomeEmail(to: string, name: string, plan: string, affiliateCode: string) {
  await getResend().emails.send({
    from: process.env.FROM_EMAIL!,
    to,
    subject: '🎉 Willkommen! Dein Account ist aktiviert',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #7c3aed;">Willkommen, ${name}!</h1>
        <p>Dein <strong>${plan}</strong> Plan ist jetzt aktiv.</p>
        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>💰 Verdiene Geld mit uns!</h3>
          <p>Teile deinen persönlichen Affiliate-Link und verdiene <strong>30% Provision</strong>:</p>
          <code style="background: #e5e7eb; padding: 8px 16px; border-radius: 4px; font-size: 14px; display: block; word-break: break-all;">
            ${process.env.NEXT_PUBLIC_APP_URL}/?ref=${affiliateCode}
          </code>
        </div>
        <p style="color: #6b7280; font-size: 12px;">Bei Fragen antworten Sie einfach auf diese E-Mail.</p>
      </div>
    `,
  })
}

export async function sendPaymentConfirmation(to: string, amount: number, plan: string) {
  await getResend().emails.send({
    from: process.env.FROM_EMAIL!,
    to,
    subject: `✅ Zahlung bestätigt - ${plan} Plan`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #059669;">Zahlung bestätigt!</h1>
        <p>Wir haben deine Zahlung von <strong>€${amount}</strong> für den <strong>${plan}</strong> Plan erhalten.</p>
        <p>Dein Account ist sofort aktiv.</p>
      </div>
    `,
  })
}

export async function sendAffiliateCommissionEmail(to: string, amount: number, referredEmail: string) {
  await getResend().emails.send({
    from: process.env.FROM_EMAIL!,
    to,
    subject: `💰 Du hast €${amount} Provision verdient!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #7c3aed;">Glückwunsch! 🎉</h1>
        <p>${referredEmail} hat sich über deinen Affiliate-Link angemeldet.</p>
        <p>Du erhältst eine Provision von <strong>€${amount}</strong>.</p>
      </div>
    `,
  })
}
