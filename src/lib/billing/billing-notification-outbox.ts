import { getDb } from '@/lib/db'
import { sendSubscriptionConfirmationEmail, sendCancellationConfirmationEmail, ResendSendError } from '@/lib/email'
import {
  MAX_BILLING_NOTIFICATION_ATTEMPTS,
  BILLING_NOTIFICATION_BACKOFF_SECONDS,
  BILLING_NOTIFICATION_LEASE_SECONDS,
} from '@/lib/billing/billing-notification-config'
import { captureError } from '@/lib/observability/sentry'

export type BillingNotificationKind = 'subscription_confirmation' | 'cancellation_confirmation'

export interface SubscriptionConfirmationPayload {
  tierName: string
  priceEuroPerMonth: number
  billingNote: string
  minimumTermMonths: number
  committedUntil: string | null
}

export interface CancellationConfirmationPayload {
  tierName: string
  requestedAt: string
  effectiveAt: string
}

/**
 * Phase 2B – Outbox-Eintrag für eine Abo-Bestätigungs-E-Mail. `dedupeKey` MUSS pro auslösendem
 * fachlichem Ereignis stabil/deterministisch sein (z.B. `subscription_confirmation:<stripeEventId>`
 * oder `cancellation_confirmation:<userId>:<effectiveAtISO>`) – ein Webhook-Retry oder ein
 * Doppelklick erzeugt dadurch nie eine zweite Zeile (UNIQUE-Constraint, `ON CONFLICT DO NOTHING`).
 * Wirft NIEMALS: ein Fehler beim Enqueue darf den aufrufenden fachlichen Vorgang (Abo-Aktivierung,
 * Kündigung) nicht rückgängig machen oder blockieren – derselbe Grundsatz wie bei
 * matchProviderAgainstOpenJobs() im Webhook-Handler.
 */
export async function enqueueBillingNotification(input: {
  userId: string
  kind: BillingNotificationKind
  dedupeKey: string
  payload: SubscriptionConfirmationPayload | CancellationConfirmationPayload
}): Promise<void> {
  try {
    await getDb().query(
      `INSERT INTO billing_notification_outbox (user_id, kind, dedupe_key, payload)
       VALUES ($1, $2, $3, $4::jsonb)
       ON CONFLICT (dedupe_key) DO NOTHING`,
      [input.userId, input.kind, input.dedupeKey, JSON.stringify(input.payload)]
    )
  } catch (err) {
    captureError(err, { userId: input.userId, operation: 'billing_notification_enqueue' })
  }
}

export interface BillingNotificationOutcome {
  id: string
  sent: boolean
  skipReason?: 'invalid_email' | 'already_claimed' | 'claim_error' | 'unknown_kind'
}

interface CandidateRow {
  id: string
  kind: BillingNotificationKind
  payload: SubscriptionConfirmationPayload | CancellationConfirmationPayload
  recipient_email: string
}

/**
 * Versendet die zu den übergebenen Outbox-IDs gehörenden E-Mails. Zustandsmaschine/Claim-Logik
 * 1:1 identisch zum bewährten Match-E-Mail-Muster (send-match-notification-emails.ts) –
 * bewusst keine zweite Implementierung der Claim-Semantik, nur eine andere Tabelle/Payload.
 */
export async function sendBillingNotifications(ids: string[]): Promise<BillingNotificationOutcome[]> {
  if (ids.length === 0) return []

  const db = getDb()
  const candidates = await db.query<CandidateRow>(
    `SELECT o.id, o.kind, o.payload, u.email AS recipient_email
     FROM billing_notification_outbox o
     JOIN users u ON u.id = o.user_id
     WHERE o.id = ANY($1::uuid[])`,
    [ids]
  )

  const outcomes: BillingNotificationOutcome[] = []

  for (const row of candidates.rows) {
    if (!row.recipient_email || !row.recipient_email.includes('@')) {
      outcomes.push({ id: row.id, sent: false, skipReason: 'invalid_email' })
      continue
    }

    let claimed: boolean
    try {
      claimed = await claimOutboxRow(row.id)
    } catch (err) {
      captureError(err, { operation: 'billing_notification_claim' })
      outcomes.push({ id: row.id, sent: false, skipReason: 'claim_error' })
      continue
    }
    if (!claimed) {
      outcomes.push({ id: row.id, sent: false, skipReason: 'already_claimed' })
      continue
    }

    try {
      if (row.kind === 'subscription_confirmation') {
        await sendSubscriptionConfirmationEmail(row.recipient_email, row.payload as SubscriptionConfirmationPayload)
      } else if (row.kind === 'cancellation_confirmation') {
        await sendCancellationConfirmationEmail(row.recipient_email, row.payload as CancellationConfirmationPayload)
      } else {
        await markFailed(row.id, 'Unbekannte Benachrichtigungsart.', true)
        outcomes.push({ id: row.id, sent: false, skipReason: 'unknown_kind' })
        continue
      }
      await markSent(row.id)
      outcomes.push({ id: row.id, sent: true })
    } catch (err) {
      captureError(err, { operation: 'billing_notification_send' })
      await markFailed(row.id, errorToSafeMessage(err), isPermanentError(err))
      outcomes.push({ id: row.id, sent: false })
    }
  }

  return outcomes
}

function isPermanentError(err: unknown): boolean {
  if (!(err instanceof ResendSendError)) return false
  return err.code !== 'rate_limit_exceeded' && err.code !== 'application_error' && err.code !== 'internal_server_error'
}

async function claimOutboxRow(id: string): Promise<boolean> {
  const db = getDb()
  const [backoffAfterAttempt1, backoffAfterAttempt2] = BILLING_NOTIFICATION_BACKOFF_SECONDS
  const result = await db.query(
    `UPDATE billing_notification_outbox
     SET status = 'sending', attempts = attempts + 1, processing_started_at = now(), last_error = NULL
     WHERE id = $1
       AND (
         status = 'pending'
         OR (
           status = 'failed' AND attempts < $2
           AND processing_started_at <= now() - (CASE attempts WHEN 1 THEN $3::int WHEN 2 THEN $4::int ELSE $4::int END * interval '1 second')
         )
         OR (
           status = 'sending' AND attempts < $2
           AND processing_started_at <= now() - ($5 * interval '1 second')
         )
       )
     RETURNING id`,
    [id, MAX_BILLING_NOTIFICATION_ATTEMPTS, backoffAfterAttempt1, backoffAfterAttempt2, BILLING_NOTIFICATION_LEASE_SECONDS]
  )
  return result.rows.length > 0
}

async function markSent(id: string): Promise<void> {
  await getDb().query(`UPDATE billing_notification_outbox SET status = 'sent', sent_at = now(), last_error = NULL WHERE id = $1`, [id])
}

async function markFailed(id: string, errorMessage: string, permanent: boolean): Promise<void> {
  const db = getDb()
  if (permanent) {
    await db.query(
      `UPDATE billing_notification_outbox SET status = 'failed', last_error = $2, attempts = GREATEST(attempts, $3) WHERE id = $1`,
      [id, errorMessage, MAX_BILLING_NOTIFICATION_ATTEMPTS]
    )
  } else {
    await db.query(`UPDATE billing_notification_outbox SET status = 'failed', last_error = $2 WHERE id = $1`, [id, errorMessage])
  }
}

function errorToSafeMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err)
  return message.slice(0, 500)
}
