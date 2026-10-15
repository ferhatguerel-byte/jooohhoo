import { Resend } from 'resend'
import type { ErrorResponse } from 'resend'
import { getAppUrl } from '@/lib/url'
import { logEvent } from '@/lib/observability/logger'

/**
 * Phase 3.6F – Resend meldet API-Fehler (ungültige Adresse, Rate-Limit, ...) NICHT über eine
 * geworfene Exception, sondern über `{ data: null, error: {...} }` im Rückgabewert. Bis zu dieser
 * Härtung wurde dieser Rückgabewert nie geprüft – ein von Resend abgelehnter Versand sah für den
 * Aufrufer wie ein erfolgreicher `await send(...)` aus. `code` entspricht exakt
 * `ErrorResponse['name']` aus der tatsächlich installierten Resend-SDK-Typdefinition (keine
 * erfundenen Fehlercodes), ermöglicht der Retry-Logik in
 * src/lib/matching/send-match-notification-emails.ts eine echte Fehlerklassifizierung
 * (transient vs. permanent) statt jeden Fehler gleich zu behandeln.
 */
export class ResendSendError extends Error {
  code: ErrorResponse['name']
  constructor(message: string, code: ErrorResponse['name']) {
    super(message)
    this.name = 'ResendSendError'
    this.code = code
  }
}

/** Verhindert HTML-Injection in E-Mails über nutzergesteuerte Texte (Nachrichten, Firmennamen, Betreffs). */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

let resendClient: Resend | undefined

function getResend(): Resend {
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY || 're_build_placeholder')
  }
  return resendClient
}

/**
 * Phase 4.4 (Teil D/5) – zentrale Stelle für ALLE Resend-Aufrufe. Ein unerwarteter Resend-Fehler
 * (Netzwerk-/SDK-Exception ODER `result.error`) wird hier EINMAL strukturiert geloggt + ans
 * Error-Tracking gemeldet, statt an jeder der zahlreichen Aufrufstellen (Angebots-/Chat-
 * Nachrichten, Support-Tickets, Match-Notifications, Passwort-Reset) einzeln. Niemals die
 * Empfänger-E-Mail-Adresse loggen (Teil E) – nur Betreff-Länge/Fehlercode als unkritischer Kontext.
 */
async function send(to: string, subject: string, html: string, text?: string) {
  if (!process.env.RESEND_API_KEY || !process.env.FROM_EMAIL) {
    console.log(`[E-Mail nicht versendet – kein RESEND_API_KEY] An: ${to} | Betreff: ${subject}`)
    return
  }
  try {
    const result = await getResend().emails.send({ from: process.env.FROM_EMAIL, to, subject, html, ...(text ? { text } : {}) })
    if (result.error) {
      logEvent('resend_send_failed', 'error', { operation: 'resend_send', errorCode: result.error.name })
      throw new ResendSendError(result.error.message, result.error.name)
    }
  } catch (err) {
    if (err instanceof ResendSendError) throw err
    // Netzwerk-/SDK-Exception (nicht der reguläre `result.error`-Pfad oben, der bereits geloggt hat).
    logEvent('resend_send_failed', 'error', { operation: 'resend_send' }, err)
    throw err
  }
}

/** Kürzt einen Text auf eine sinnvolle Länge für E-Mails, ohne HTML mitten in einer Entität abzuschneiden. */
function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength).trimEnd()}…`
}

export async function sendNewOfferEmail(to: string, jobTitle: string, price: number, companyName: string) {
  const safeTitle = escapeHtml(jobTitle)
  const safeCompany = escapeHtml(companyName)
  await send(
    to,
    `📋 Neues Angebot für „${jobTitle}“`,
    `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #1e3a8a;">Neues Angebot erhalten</h1>
      <p><strong>${safeCompany}</strong> hat ein Angebot über <strong>€${price}</strong> für Ihren Auftrag
      „${safeTitle}“ abgegeben.</p>
      <a href="${getAppUrl()}/dashboard/auftraege"
         style="display: inline-block; background: #1e3a8a; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 16px;">
        Angebot ansehen →
      </a>
    </div>`
  )
}

export async function sendNewMessageEmail(to: string, senderName: string, message: string) {
  const safeSender = escapeHtml(senderName)
  await send(
    to,
    `💬 Neue Nachricht von ${senderName}`,
    `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #1e3a8a;">Neue Nachricht</h1>
      <p><strong>${safeSender}</strong> hat Ihnen geschrieben:</p>
      <p style="background: #f1f5f9; padding: 16px; border-radius: 8px; white-space: pre-wrap;">${escapeHtml(message)}</p>
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
      <p><strong>${escapeHtml(companyName)}</strong> hat eine neue Anfrage in der Kategorie <strong>${escapeHtml(category)}</strong> gestellt:</p>
      <p style="background: #f1f5f9; padding: 16px; border-radius: 8px; white-space: pre-wrap;">${escapeHtml(message)}</p>
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
      <p style="background: #f1f5f9; padding: 16px; border-radius: 8px; white-space: pre-wrap;">${escapeHtml(message)}</p>
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
      <p>Sehr geehrte(r) ${escapeHtml(companyName)},</p>
      <p style="background: #fff7ed; border: 1px solid #fed7aa; padding: 16px; border-radius: 8px; white-space: pre-wrap;">${escapeHtml(message)}</p>
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
      <h1 style="color: #059669;">Herzlichen Glückwunsch, ${escapeHtml(companyName)}!</h1>
      <p>Ihr Angebot wurde vom Auftraggeber angenommen. Der Auftrag wurde Ihnen zugeteilt.</p>
      <a href="${getAppUrl()}/dashboard/jobs"
         style="display: inline-block; background: #059669; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 16px;">
        Zum Dashboard →
      </a>
    </div>`
  )
}

export interface MatchNotificationJobInfo {
  title: string
  gewerk: string
  plz: string
  ort: string
  description: string
  budgetMin: number | null
  budgetMax: number | null
  deadline: string | Date | null
}

/**
 * Phase 3.6D – Match-Benachrichtigung an einen Unternehmer. Enthält AUSSCHLIESSLICH öffentlich
 * bereits erreichbare Projekt-Eckdaten (Gewerk/Ort/Budget/gekürzte Beschreibung) – niemals Name,
 * E-Mail oder Telefonnummer des Auftraggebers (diese Felder existieren ohnehin nicht auf `jobs`),
 * niemals den internen Match-Score oder sonstige interne Matching-Daten. Der Score wird bewusst
 * nicht als Zahl kommuniziert ("Sie haben 87 Punkte"), sondern nur als Einladung
 * ("passt zu Ihrem Profil") – der Score ist ein internes technisches Signal, kein öffentliches
 * Qualitätsurteil (siehe Phase-3.4/3.6-Architektur).
 */
export async function sendMatchNotificationEmail(to: string, job: MatchNotificationJobInfo) {
  const safeTitle = escapeHtml(job.title)
  const safeGewerk = escapeHtml(job.gewerk)
  const safePlz = escapeHtml(job.plz)
  const safeOrt = escapeHtml(job.ort)
  const shortDescription = truncate(job.description, 280)
  const safeDescription = escapeHtml(shortDescription)
  const jobsUrl = `${getAppUrl()}/dashboard/jobs`

  const budgetText =
    job.budgetMin || job.budgetMax ? `€${job.budgetMin ?? '?'}${job.budgetMax ? ` – €${job.budgetMax}` : ''}` : null
  const deadlineText = job.deadline ? new Date(job.deadline).toLocaleDateString('de-DE') : null

  const html = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #1e3a8a;">Ein neuer Auftrag passt zu Ihrem Profil</h1>
      <p>Auf BAUVERSUS wurde ein Bauprojekt eingestellt, das zu Ihrem Gewerk und Ihrer Region passt.</p>
      <div style="background: #f1f5f9; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 0 0 8px 0; font-weight: bold;">${safeTitle}</p>
        <p style="margin: 0 0 8px 0; color: #475569;">${safeGewerk} · ${safePlz} ${safeOrt}</p>
        ${budgetText ? `<p style="margin: 0 0 8px 0;"><strong>Budget:</strong> ${escapeHtml(budgetText)}</p>` : ''}
        ${deadlineText ? `<p style="margin: 0 0 8px 0;"><strong>Gewünschter Termin:</strong> ${escapeHtml(deadlineText)}</p>` : ''}
        <p style="margin: 8px 0 0 0; color: #475569;">${safeDescription}</p>
      </div>
      <a href="${jobsUrl}"
         style="display: inline-block; background: #1e3a8a; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 8px;">
        Auftrag ansehen →
      </a>
      <p style="color: #64748b; font-size: 13px; margin-top: 24px;">
        Sie erhalten diese Nachricht, weil BAUVERSUS diesen Auftrag als passend zu Ihrem Unternehmensprofil
        eingestuft hat. Melden Sie sich an, um Details zu sehen und ein Angebot abzugeben.
      </p>
    </div>`

  const text = [
    'Ein neuer Auftrag passt zu Ihrem Profil',
    '',
    job.title,
    `${job.gewerk} · ${job.plz} ${job.ort}`,
    budgetText ? `Budget: ${budgetText}` : null,
    deadlineText ? `Gewünschter Termin: ${deadlineText}` : null,
    '',
    shortDescription,
    '',
    `Auftrag ansehen: ${jobsUrl}`,
  ]
    .filter((line) => line !== null)
    .join('\n')

  await send(to, `🔧 Neuer passender Auftrag: „${job.title}“`, html, text)
}

export interface SubscriptionConfirmationEmailInfo {
  tierName: string
  priceEuroPerMonth: number
  billingNote: string
  minimumTermMonths: number
  committedUntil: string | null
  /** Manueller Produktionstest der Zustellung (siehe billing-notification-outbox.ts) – KEIN
   * echter Vertragsabschluss. Bei true wird Betreff und Inhalt eindeutig als Test gekennzeichnet,
   * statt die reguläre Vertragsbestätigung zu versenden. Default (undefined/false): unverändertes
   * bisheriges Verhalten. */
  isTest?: boolean
}

/**
 * Phase 2B – Bestätigung des Abo-Abschlusses. Enthält AUSSCHLIESSLICH die zum Zeitpunkt des
 * Vertragsschlusses im Outbox-Eintrag eingefrorenen Tarifdaten (siehe
 * src/lib/billing/billing-notification-outbox.ts) – keine zum Versandzeitpunkt aktuellen
 * TIERS-Werte, keine Widerrufsbelehrung, kein AGB-Auszug: diese Texte sind nicht Gegenstand
 * dieser technischen Phase und bedürfen vor jeder Veröffentlichung einer eigenständigen
 * rechtlichen Freigabe (siehe Verbraucherrecht-Audit, Freigabepunkt D).
 */
export async function sendSubscriptionConfirmationEmail(to: string, info: SubscriptionConfirmationEmailInfo) {
  const isTest = info.isTest === true
  const safeTierName = escapeHtml(info.tierName)
  const safeBillingNote = escapeHtml(info.billingNote)
  const committedUntilText = info.committedUntil
    ? new Date(info.committedUntil).toLocaleDateString('de-DE')
    : null
  const membershipUrl = `${getAppUrl()}/dashboard/einstellungen/mitgliedschaft`

  // Im Testmodus wird die GESAMTE Mail als Test erkennbar, nicht nur ein zusätzlicher Hinweis:
  // eigene Überschrift, eigener Schlusssatz (statt der Vertragsbestätigung), zusätzlich weiterhin
  // der rot hervorgehobene Banner (unverändert erhalten, siehe testBannerHtml/testBannerText
  // unten). Im Normalmodus bleibt jede dieser drei Stellen exakt wie zuvor.
  const heading = isTest ? 'Technischer E-Mail-Test erfolgreich' : 'Ihr Abo wurde aktiviert'
  const footerSentence = isTest
    ? 'Diese E-Mail bestätigt lediglich, dass der technische Zustellweg für Abo-Benachrichtigungen funktioniert. Die oben gezeigten Werte sind synthetisch und stammen aus keinem echten Vertrag.'
    : 'Diese E-Mail bestätigt den Abschluss Ihres BAUVERSUS-Abos mit den oben genannten Eckdaten.'

  // Nur bei isTest===true gerendert, direkt unter der Überschrift – unübersehbar vor den
  // eigentlichen (im Testfall ohnehin nur synthetischen) Tarifdaten.
  const testBannerHtml = isTest
    ? `<p style="background: #fee2e2; border: 2px solid #dc2626; color: #991b1b; padding: 12px 16px; border-radius: 8px; font-weight: bold; margin: 0 0 16px 0;">
        Dies ist ein interner technischer Test der E-Mail-Zustellung. Es wurde kein Vertrag abgeschlossen oder verändert.
      </p>`
    : ''
  const testBannerText = isTest
    ? 'Dies ist ein interner technischer Test der E-Mail-Zustellung. Es wurde kein Vertrag abgeschlossen oder verändert.'
    : ''

  const html = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #1e3a8a;">${heading}</h1>
      ${testBannerHtml}
      <div style="background: #f1f5f9; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 0 0 8px 0;"><strong>Tarif:</strong> ${safeTierName}</p>
        <p style="margin: 0 0 8px 0;"><strong>Preis:</strong> €${info.priceEuroPerMonth} / Monat zzgl. MwSt.</p>
        <p style="margin: 0 0 8px 0;"><strong>Abrechnung:</strong> ${safeBillingNote}</p>
        ${
          info.minimumTermMonths > 0
            ? `<p style="margin: 0 0 8px 0;"><strong>Mindestlaufzeit:</strong> ${info.minimumTermMonths} Monate${committedUntilText ? ` (bis ${committedUntilText})` : ''}</p>`
            : ''
        }
      </div>
      <a href="${membershipUrl}"
         style="display: inline-block; background: #1e3a8a; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 8px;">
        Abo verwalten →
      </a>
      <p style="color: #64748b; font-size: 13px; margin-top: 24px;">
        ${footerSentence}
      </p>
    </div>`

  const text = [
    heading,
    '',
    testBannerText || null,
    `Tarif: ${info.tierName}`,
    `Preis: €${info.priceEuroPerMonth} / Monat zzgl. MwSt.`,
    `Abrechnung: ${info.billingNote}`,
    info.minimumTermMonths > 0
      ? `Mindestlaufzeit: ${info.minimumTermMonths} Monate${committedUntilText ? ` (bis ${committedUntilText})` : ''}`
      : null,
    '',
    `Abo verwalten: ${membershipUrl}`,
    // Der Normalmodus hatte diesen Satz bisher NUR im HTML, nie im Text-Fallback – unverändert so
    // belassen (Vorgabe: normaler Modus darf sich nicht ändern). Im Testmodus wird er zusätzlich
    // auch im Text-Fallback ausgegeben, damit auch reine Text-Clients eindeutig erkennen, dass es
    // sich um einen Test handelt.
    isTest ? '' : null,
    isTest ? footerSentence : null,
  ]
    .filter((line) => line !== null)
    .join('\n')

  const subjectPrefix = isTest ? '[TECHNISCHER TEST – KEIN VERTRAG] ' : ''
  const subject = isTest ? `${subjectPrefix}${heading}` : `Ihr BAUVERSUS-Abo (${info.tierName}) wurde aktiviert`
  await send(to, subject, html, text)
}

export interface CancellationConfirmationEmailInfo {
  tierName: string
  requestedAt: string
  effectiveAt: string
}

/**
 * Phase 2B – Bestätigung einer eingegangenen Kündigung. Übermittelt ausschließlich den
 * tatsächlich serverseitig gespeicherten Zugangszeitpunkt (`requestedAt`) und den berechneten
 * Beendigungszeitpunkt (`effectiveAt`) – keine erfundenen Fristen, kein Widerrufs-/§312k-Text.
 */
export async function sendCancellationConfirmationEmail(to: string, info: CancellationConfirmationEmailInfo) {
  const safeTierName = escapeHtml(info.tierName)
  const requestedAtText = new Date(info.requestedAt).toLocaleString('de-DE')
  const effectiveAtText = new Date(info.effectiveAt).toLocaleDateString('de-DE')
  const membershipUrl = `${getAppUrl()}/dashboard/einstellungen/mitgliedschaft`

  const html = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #1e3a8a;">Ihre Kündigung wurde registriert</h1>
      <div style="background: #f1f5f9; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 0 0 8px 0;"><strong>Tarif:</strong> ${safeTierName}</p>
        <p style="margin: 0 0 8px 0;"><strong>Eingegangen am:</strong> ${escapeHtml(requestedAtText)}</p>
        <p style="margin: 0;"><strong>Vertragsende:</strong> ${escapeHtml(effectiveAtText)}</p>
      </div>
      <p>Bis zu diesem Zeitpunkt behalten Sie den vollen Zugriff auf Ihr Abo. Sie können die
      Kündigung bis dahin jederzeit in Ihrem Konto zurückziehen.</p>
      <a href="${membershipUrl}"
         style="display: inline-block; background: #1e3a8a; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 8px;">
        Zur Mitgliedschaft →
      </a>
    </div>`

  const text = [
    'Ihre Kündigung wurde registriert',
    '',
    `Tarif: ${info.tierName}`,
    `Eingegangen am: ${requestedAtText}`,
    `Vertragsende: ${effectiveAtText}`,
    '',
    'Bis zu diesem Zeitpunkt behalten Sie den vollen Zugriff auf Ihr Abo. Sie können die Kündigung',
    'bis dahin jederzeit in Ihrem Konto zurückziehen.',
    '',
    `Zur Mitgliedschaft: ${membershipUrl}`,
  ].join('\n')

  await send(to, `Ihre Kündigung (${info.tierName}) wurde registriert`, html, text)
}
