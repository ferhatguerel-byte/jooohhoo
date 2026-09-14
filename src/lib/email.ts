import { Resend } from 'resend'
import { getAppUrl } from '@/lib/url'

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
      <a href="${getAppUrl()}/dashboard/auftraege"
         style="display: inline-block; background: #1e3a8a; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 16px;">
        Angebot ansehen →
      </a>
    </div>`
  )
}

export async function sendNewMessageEmail(to: string, senderName: string, message: string) {
  await send(
    to,
    `💬 Neue Nachricht von ${senderName}`,
    `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #1e3a8a;">Neue Nachricht</h1>
      <p><strong>${senderName}</strong> hat Ihnen geschrieben:</p>
      <p style="background: #f1f5f9; padding: 16px; border-radius: 8px;">${message}</p>
    </div>`
  )
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  await send(
    to,
    `Passwort zurücksetzen – BAUVERSUS`,
    `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #17202a;">Passwort zurücksetzen</h1>
      <p>Sie haben angefragt, Ihr Passwort zurückzusetzen. Klicken Sie auf den folgenden Link, um ein neues
      Passwort zu vergeben. Der Link ist eine Stunde gültig.</p>
      <a href="${resetUrl}"
         style="display: inline-block; background: #f47b20; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 16px;">
        Neues Passwort vergeben →
      </a>
      <p style="color: #64748b; font-size: 13px; margin-top: 24px;">
        Falls Sie diese Anfrage nicht gestellt haben, können Sie diese E-Mail ignorieren.
      </p>
    </div>`
  )
}

export async function sendNewTicketEmail(to: string, companyName: string, category: string, subject: string, message: string) {
  await send(
    to,
    `🆘 Neue Support-Anfrage: „${subject}“`,
    `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #1e3a8a;">Neue Support-Anfrage</h1>
      <p><strong>${companyName}</strong> hat eine neue Anfrage in der Kategorie <strong>${category}</strong> gestellt:</p>
      <p style="background: #f1f5f9; padding: 16px; border-radius: 8px;">${message}</p>
      <a href="${getAppUrl()}/dashboard/admin/support"
         style="display: inline-block; background: #1e3a8a; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 16px;">
        Ticket ansehen →
      </a>
    </div>`
  )
}

export async function sendTicketReplyEmail(to: string, subject: string, isFromSupport: boolean, message: string) {
  await send(
    to,
    isFromSupport ? `💬 Antwort zu deiner Anfrage: „${subject}“` : `💬 Neue Antwort im Support-Ticket: „${subject}“`,
    `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #1e3a8a;">${isFromSupport ? 'Antwort vom Support' : 'Neue Nachricht im Support-Ticket'}</h1>
      <p style="background: #f1f5f9; padding: 16px; border-radius: 8px;">${message}</p>
      <a href="${getAppUrl()}/dashboard/support"
         style="display: inline-block; background: #1e3a8a; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 16px;">
        Zum Ticket →
      </a>
    </div>`
  )
}

export async function sendAdminWarningEmail(to: string, companyName: string, message: string) {
  await send(
    to,
    `⚠️ Wichtiger Hinweis zu Ihrem BAUVERSUS-Konto`,
    `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #b45309;">Hinweis von BAUVERSUS</h1>
      <p>Sehr geehrte(r) ${companyName},</p>
      <p style="background: #fff7ed; border: 1px solid #fed7aa; padding: 16px; border-radius: 8px;">${message}</p>
      <p style="color: #64748b; font-size: 13px; margin-top: 24px;">
        Bei Fragen wenden Sie sich bitte über das Support Center an uns.
      </p>
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
      <a href="${getAppUrl()}/dashboard/jobs"
         style="display: inline-block; background: #059669; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 16px;">
        Zum Dashboard →
      </a>
    </div>`
  )
}
