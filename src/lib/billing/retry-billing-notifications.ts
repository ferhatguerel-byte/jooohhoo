import { getDb } from '@/lib/db'
import { sendBillingNotifications, type BillingNotificationOutcome } from '@/lib/billing/billing-notification-outbox'
import {
  MAX_BILLING_NOTIFICATION_ATTEMPTS,
  BILLING_NOTIFICATION_BACKOFF_SECONDS,
  BILLING_NOTIFICATION_LEASE_SECONDS,
  MAX_BILLING_NOTIFICATIONS_PER_RUN,
} from '@/lib/billing/billing-notification-config'

export interface BillingNotificationRetryResult {
  candidateCount: number
  outcomes: BillingNotificationOutcome[]
}

/**
 * Phase 2B – periodischer Retry-Batch für die Abo-Bestätigungs-Outbox. Strukturell identisch zu
 * runMatchEmailRetryBatch() (Phase 3.6F) – eigene Funktion statt Parametrisierung der bestehenden,
 * um die bewährte, bereits produktiv gehärtete Match-E-Mail-Logik nicht anzufassen (Vorgabe:
 * bestehende Stripe-Webhook-/Subscription-Mechanik nicht regressiv verändern, und dasselbe gilt
 * sinngemäß für den unabhängigen Match-E-Mail-Kanal).
 */
export async function runBillingNotificationRetryBatch(): Promise<BillingNotificationRetryResult> {
  await finalizeExhaustedStaleSendingRows()

  const candidateIds = await getRetryCandidateIds(MAX_BILLING_NOTIFICATIONS_PER_RUN)
  if (candidateIds.length === 0) {
    return { candidateCount: 0, outcomes: [] }
  }

  const outcomes = await sendBillingNotifications(candidateIds)
  return { candidateCount: candidateIds.length, outcomes }
}

async function getRetryCandidateIds(limit: number): Promise<string[]> {
  const db = getDb()
  const [backoffAfterAttempt1, backoffAfterAttempt2] = BILLING_NOTIFICATION_BACKOFF_SECONDS
  const result = await db.query<{ id: string }>(
    `SELECT id FROM billing_notification_outbox
     WHERE status = 'pending'
        OR (
          status = 'failed' AND attempts < $1
          AND processing_started_at <= now() - (CASE attempts WHEN 1 THEN $2::int WHEN 2 THEN $3::int ELSE $3::int END * interval '1 second')
        )
        OR (
          status = 'sending' AND attempts < $1
          AND processing_started_at <= now() - ($4 * interval '1 second')
        )
     ORDER BY created_at ASC
     LIMIT $5`,
    [MAX_BILLING_NOTIFICATION_ATTEMPTS, backoffAfterAttempt1, backoffAfterAttempt2, BILLING_NOTIFICATION_LEASE_SECONDS, limit]
  )
  return result.rows.map((row) => row.id)
}

async function finalizeExhaustedStaleSendingRows(): Promise<void> {
  const db = getDb()
  await db.query(
    `UPDATE billing_notification_outbox
     SET status = 'failed', last_error = COALESCE(last_error, $2)
     WHERE status = 'sending' AND attempts >= $1
       AND processing_started_at <= now() - ($3 * interval '1 second')`,
    [MAX_BILLING_NOTIFICATION_ATTEMPTS, 'Maximale Anzahl an Versandversuchen erreicht (Lease abgelaufen).', BILLING_NOTIFICATION_LEASE_SECONDS]
  )
}
