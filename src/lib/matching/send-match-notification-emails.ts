import { z } from 'zod'
import { getDb } from '@/lib/db'
import { sendMatchNotificationEmail, ResendSendError } from '@/lib/email'
import { MAX_MATCH_EMAIL_ATTEMPTS, MATCH_EMAIL_BACKOFF_SECONDS, MATCH_EMAIL_LEASE_SECONDS } from '@/lib/matching/email-retry-config'
import { ANALYTICS_EVENTS } from '@/lib/analytics'
import { trackEvent } from '@/lib/analytics-events'

const emailSchema = z.string().email()

export type SendMatchNotificationSkipReason =
  | 'not_a_provider'
  | 'email_notifications_disabled'
  | 'invalid_email'
  | 'already_claimed'

export interface SendMatchNotificationOutcome {
  notificationId: string
  sent: boolean
  skipReason?: SendMatchNotificationSkipReason
}

interface CandidateRow {
  notification_id: string
  job_id: string
  provider_id: string
  provider_email: string
  email_notifications: boolean
  provider_role: 'auftraggeber' | 'subunternehmer'
  title: string
  gewerk: string
  plz: string
  ort: string
  description: string
  budget_min: number | null
  budget_max: number | null
  deadline: string | null
}

/**
 * Phase 3.6F – Resend-Fehlercodes, bei denen ein erneuter Versand mit identischen Parametern
 * garantiert wieder fehlschlagen würde (Konfigurations-/Validierungsfehler unserer eigenen
 * Anfrage, nicht ein vorübergehendes Problem des Versands). Ausschließlich Werte aus der
 * tatsächlich installierten Resend-SDK-Typdefinition (RESEND_ERROR_CODE_KEY in
 * node_modules/resend/dist/index.d.mts) – keine erfundenen Codes. Alles, was hier NICHT
 * aufgeführt ist (insb. rate_limit_exceeded, application_error, internal_server_error,
 * concurrent_idempotent_requests, monthly_quota_exceeded, daily_quota_exceeded, sowie jeder
 * unbekannte künftige Code), gilt als transient und bleibt bis MAX_MATCH_EMAIL_ATTEMPTS
 * retryfähig – ein sicherer Default, da das Attempt-Limit jede Wiederholung ohnehin begrenzt.
 */
const NON_RETRYABLE_RESEND_ERROR_CODES = new Set<string>([
  'validation_error',
  'invalid_from_address',
  'invalid_parameter',
  'missing_required_field',
  'invalid_attachment',
  'invalid_region',
  'missing_api_key',
  'invalid_api_key',
  'restricted_api_key',
  'invalid_access',
  'security_error',
  'not_found',
  'method_not_allowed',
  'invalid_idempotency_key',
  'invalid_idempotent_request',
])

function isPermanentError(err: unknown): boolean {
  return err instanceof ResendSendError && NON_RETRYABLE_RESEND_ERROR_CODES.has(err.code)
}

/**
 * Phase 3.6D/3.6F – versendet E-Mails für konkret übergebene match_notification-IDs. Zwei
 * Aufrufer mit unterschiedlicher ID-Herkunft, dieselbe Logik (keine zweite Implementierung):
 * 1. run-matching.ts (Phase 3.6A/D, unverändert): NEU erzeugte IDs aus
 *    createMatchNotifications().createdIds direkt nach dem Matching.
 * 2. retry-match-notification-emails.ts (Phase 3.6F): IDs aus getEmailRetryCandidateIds(), von
 *    einem periodischen Retry-Batch ermittelt.
 * In beiden Fällen entscheidet ausschließlich der atomare Claim (claimNotification), ob eine
 * Zeile tatsächlich verarbeitet wird – die Lese-Query hier filtert bewusst NICHT zusätzlich nach
 * Status, um die Eligibility-Logik nicht doppelt zu pflegen (einzige Quelle der Wahrheit: die
 * Claim-Query unten).
 *
 * KLAIM-/ZUSTANDSMASCHINE (Phase 3.6F, ersetzt die Phase-3.6D-Übergangslösung):
 *
 *   pending ──claim──► sending ──Erfolg──► sent
 *                          │
 *                          └──Fehler──► failed ──Backoff abgelaufen──► (erneuter claim) sending
 *
 * Zusätzlich: eine seit MATCH_EMAIL_LEASE_SECONDS hängende 'sending'-Zeile (Prozessabsturz
 * zwischen Claim und Versand-Bestätigung) gilt als abgebrochen und ist über denselben Claim
 * wieder erreichbar ("Lease-Recovery") – ohne diesen Mechanismus wäre eine per Crash unterbrochene
 * Zustellung für immer unsichtbar hängen geblieben (das in Phase 3.6D dokumentierte Risiko).
 *
 * EXACTLY-ONCE IST NICHT GARANTIERBAR (Phase 3.6F §4, bewusst explizit dokumentiert): Resend
 * (externes HTTP-System) und PostgreSQL sind zwei getrennte Systeme ohne gemeinsame Transaktion.
 * Stirbt der Prozess exakt zwischen "Resend hat die E-Mail akzeptiert" und dem anschließenden
 * `UPDATE ... SET status='sent'`, bleibt die Zeile als 'sending' liegen; nach Ablauf der Lease
 * wird sie erneut versucht – die E-Mail könnte dadurch ein zweites Mal ankommen. Es gibt keine
 * verteilte Transaktion, die das ausschließen könnte. Ziel ist deshalb ausdrücklich NUR:
 * at-most-once CLAIM (mehrere Worker versuchen nie gleichzeitig erfolgreich dieselbe Zeile zu
 * beanspruchen, real gegen PostgreSQL verifiziert) plus eine bewusst konservative Lease-Dauer
 * (5 Minuten – ein normaler Resend-Request dauert Sekunden), die die Wahrscheinlichkeit eines
 * Doppelversands stark reduziert, ohne ihn auf Null zu garantieren.
 *
 * attempts wird ausschließlich beim tatsächlichen Claim erhöht (§22) – für
 * email_notifications=false, unplausible E-Mail oder Rolle != subunternehmer wird gar nicht erst
 * geclaimt, die Notification bleibt exakt in ihrem aktuellen Status stehen.
 */
export async function sendMatchNotificationEmails(notificationIds: string[]): Promise<SendMatchNotificationOutcome[]> {
  if (notificationIds.length === 0) return []

  const db = getDb()
  const candidates = await db.query<CandidateRow>(
    `SELECT n.id AS notification_id, n.job_id, n.provider_id, u.email AS provider_email, u.email_notifications, u.role AS provider_role,
            j.title, j.gewerk, j.plz, j.ort, j.description, j.budget_min, j.budget_max, j.deadline
     FROM match_notifications n
     JOIN users u ON u.id = n.provider_id
     JOIN jobs j ON j.id = n.job_id
     WHERE n.id = ANY($1::uuid[])`,
    [notificationIds]
  )

  const outcomes: SendMatchNotificationOutcome[] = []

  // Bewusst sequenziell: siehe Phase-3.6D-Begründung (Fehlerzuordnung 1:1 pro Notification),
  // weiterhin gültig – Bulk-Versand würde das verschlechtern (Phase 3.6F §19).
  for (const row of candidates.rows) {
    if (row.provider_role !== 'subunternehmer') {
      outcomes.push({ notificationId: row.notification_id, sent: false, skipReason: 'not_a_provider' })
      continue
    }
    if (!row.email_notifications) {
      outcomes.push({ notificationId: row.notification_id, sent: false, skipReason: 'email_notifications_disabled' })
      continue
    }
    if (!emailSchema.safeParse(row.provider_email).success) {
      outcomes.push({ notificationId: row.notification_id, sent: false, skipReason: 'invalid_email' })
      continue
    }

    const claimed = await claimNotification(row.notification_id)
    if (!claimed) {
      outcomes.push({ notificationId: row.notification_id, sent: false, skipReason: 'already_claimed' })
      continue
    }

    try {
      await sendMatchNotificationEmail(row.provider_email, {
        title: row.title,
        gewerk: row.gewerk,
        plz: row.plz,
        ort: row.ort,
        description: row.description,
        budgetMin: row.budget_min,
        budgetMax: row.budget_max,
        deadline: row.deadline,
      })
      await markSent(row.notification_id)
      // Phase 3.6G: MATCH_EMAIL_SENT NUR nach bestätigtem Resend-Erfolg + erfolgreichem finalen
      // 'sent'-Status (nicht bereits beim Claim/'sending', siehe Zustandsmaschine oben). Die
      // Idempotenz über notificationId sorgt dafür, dass ein bei einem früheren Versuch
      // fehlgeschlagenes und danach erfolgreich wiederholtes Retry genau EIN fachliches Event
      // erzeugt (Phase 3.6F/3.6G, kein Doppel-Event über mehrere Retry-Versuche hinweg). EIGENES
      // try/catch: ein Analytics-Fehler HIER darf den bereits erfolgreichen Versand (status
      // bereits 'sent' in der DB) NIEMALS nachträglich als fehlgeschlagen behandeln – deshalb
      // separat vom äußeren catch (der markFailed() aufruft).
      try {
        await trackEvent({
          event: ANALYTICS_EVENTS.MATCH_EMAIL_SENT,
          jobId: row.job_id,
          providerId: row.provider_id,
          notificationId: row.notification_id,
          idempotencyKey: `match_email_sent:${row.notification_id}`,
        })
      } catch (analyticsError) {
        console.error('MATCH_EMAIL_SENT-Analytics fehlgeschlagen:', row.notification_id, analyticsError)
      }
      outcomes.push({ notificationId: row.notification_id, sent: true })
    } catch (err) {
      await markFailed(row.notification_id, errorToSafeMessage(err), isPermanentError(err))
      outcomes.push({ notificationId: row.notification_id, sent: false })
    }
  }

  return outcomes
}

/**
 * Atomarer Claim: eine Zeile wird NUR beansprucht, wenn genau EINE der drei Bedingungen zutrifft
 * (real gegen PostgreSQL verifiziert, siehe Abschlussbericht):
 * - status='pending' (noch nie versucht)
 * - status='failed' UND attempts < MAX UND der nach `attempts` gestufte Backoff seit dem letzten
 *   Versuch (processing_started_at) ist abgelaufen
 * - status='sending' UND attempts < MAX UND die Lease ist abgelaufen (Crash-Recovery)
 * Ein einzelnes UPDATE-Statement mit dieser WHERE-Bedingung – Postgres serialisiert konkurrierende
 * UPDATEs auf dieselbe Zeile über den Row-Lock; nach dem Commit der ersten Transaktion matcht die
 * WHERE-Bedingung einer zweiten, zuvor blockierten UPDATE-Anweisung nicht mehr -> 0 Zeilen -> kein
 * Double-Claim möglich. Kein DB-Lock bleibt während des externen Resend-Requests offen (Claim ist
 * ein abgeschlossenes Einzelstatement, Versand und Ergebnis-Update folgen unabhängig danach).
 */
async function claimNotification(id: string): Promise<boolean> {
  const db = getDb()
  const [backoffAfterAttempt1, backoffAfterAttempt2] = MATCH_EMAIL_BACKOFF_SECONDS
  const result = await db.query(
    `UPDATE match_notifications
     SET status = 'sending', attempts = attempts + 1, processing_started_at = now(), last_error = NULL
     WHERE id = $1
       AND (
         status = 'pending'
         OR (
           status = 'failed' AND attempts < $2
           AND processing_started_at <= now() - (CASE attempts WHEN 1 THEN $3 WHEN 2 THEN $4 ELSE $4 END * interval '1 second')
         )
         OR (
           status = 'sending' AND attempts < $2
           AND processing_started_at <= now() - ($5 * interval '1 second')
         )
       )
     RETURNING id`,
    [id, MAX_MATCH_EMAIL_ATTEMPTS, backoffAfterAttempt1, backoffAfterAttempt2, MATCH_EMAIL_LEASE_SECONDS]
  )
  return result.rows.length > 0
}

async function markSent(id: string): Promise<void> {
  const db = getDb()
  await db.query(`UPDATE match_notifications SET status = 'sent', sent_at = now(), last_error = NULL WHERE id = $1`, [id])
}

/**
 * Bei einem permanenten Fehler (Resend würde denselben Request garantiert wieder ablehnen) wird
 * `attempts` zusätzlich auf MAX_MATCH_EMAIL_ATTEMPTS angehoben (GREATEST, nie verringern) – die
 * Zeile ist damit sofort dauerhaft von weiteren automatischen Retries ausgeschlossen, ohne einen
 * eigenen "permanent failed"-Status zu erfinden (Phase 3.6F §15: kein sinnloser Retry-Loop bei
 * bekannt ungültigen Anfragen).
 */
async function markFailed(id: string, errorMessage: string, permanent: boolean): Promise<void> {
  const db = getDb()
  if (permanent) {
    await db.query(`UPDATE match_notifications SET status = 'failed', last_error = $2, attempts = GREATEST(attempts, $3) WHERE id = $1`, [
      id,
      errorMessage,
      MAX_MATCH_EMAIL_ATTEMPTS,
    ])
  } else {
    await db.query(`UPDATE match_notifications SET status = 'failed', last_error = $2 WHERE id = $1`, [id, errorMessage])
  }
}

/** Begrenzte, sichere Fehlermeldung ohne mögliche Secrets/Zugangsdaten für last_error. */
function errorToSafeMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err)
  return message.slice(0, 500)
}
