import { Resend } from 'resend'

let resendClient: Resend | undefined

function getResend(): Resend {
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY || 're_build_placeholder')
  }
  return resendClient
}

async function send(to: string, subject: string, html: string) {
  if (!process.env.RESEND_API_KEY || !process.env.FROM_EMAIL) {
    console.log(`[E-Mail nicht versendet – kein RESEND_API_KEY] An: ${to} | Betreff: ${subject}`)
    return
  }
  await getResend().emails.send({ from: process.env.FROM_EMAIL, to, subject, html })
}

export async function sendNewOfferEmail(to: string, jobTitle: string, price: number, companyName: string) {
  await send(
    to,
    `📋 Neues Angebot für „${jobTitle}“`,
    `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #1e3a8a;">Neues Angebot erhalten</h1>
      <p><strong>${companyName}</strong> hat ein Angebot über <strong>€${price}</strong> für Ihren Auftrag
      „${jobTitle}“ abgegeben.</p>
      <a href="${process.env.NEXT_PUBLIC_APP_URL || ''}/dashboard/auftraege"
         style="display: inline-block; background: #1e3a8a; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 16px;">
        Angebot ansehen →
      </a>
    </div>`
  )
}

export async function sendLeadUnlockedEmail(to: string, companyName: string) {
  await send(
    to,
    `🔓 Ein Auftraggeber hat Ihre Kontaktdaten freigeschaltet`,
    `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #1e3a8a;">Ihre Kontaktdaten wurden freigeschaltet</h1>
      <p>Ein Auftraggeber hat Ihre Kontaktdaten zu Ihrem Angebot freigeschaltet und wird sich voraussichtlich
      in Kürze bei Ihnen melden.</p>
      <p>Firma: <strong>${companyName}</strong></p>
    </div>`
  )
}

export async function sendOfferAwardedEmail(to: string, companyName: string) {
  await send(
    to,
    `🎉 Ihr Angebot wurde angenommen!`,
    `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #059669;">Herzlichen Glückwunsch, ${companyName}!</h1>
      <p>Ihr Angebot wurde vom Auftraggeber angenommen. Der Auftrag wurde Ihnen zugeteilt.</p>
      <a href="${process.env.NEXT_PUBLIC_APP_URL || ''}/dashboard/jobs"
         style="display: inline-block; background: #059669; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 16px;">
        Zum Dashboard →
      </a>
    </div>`
  )
}
