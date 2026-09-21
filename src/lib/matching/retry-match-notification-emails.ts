import { getDb } from '@/lib/db'
import { sendMatchNotificationEmails, type SendMatchNotificationOutcome } from '@/lib/matching/send-match-notification-emails'
import { MAX_MATCH_EMAIL_ATTEMPTS, MATCH_EMAIL_BACKOFF_SECONDS, MATCH_EMAIL_LEASE_SECONDS, MAX_MATCH_EMAILS_PER_RUN } from '@/lib/matching/email-retry-config'

export interface RetryBatchResult {
  /** Anzahl der in diesem Lauf tatsächlich als Claim-Kandidaten ausgewählten Notifications (<= MAX_MATCH_EMAILS_PER_RUN). */
  candidateCount: number
  outcomes: SendMatchNotificationOutcome[]
}

/**
 * Phase 3.6F – periodischer Retry-Batch für Match-Notification-E-Mails. Bestimmt selbst seine
 * Kandidaten (im Unterschied zu sendMatchNotificationEmails(), das mit konkret übergebenen IDs
 * arbeitet) und ruft anschließend dieselbe, bereits bestehende Claim-/Versand-/Statuslogik auf –
 * keine zweite Zustellungs-Implementierung.
 *
 * Ablauf:
 * 1. Hängengebliebene 'sending'-Zeilen, die bereits ihr Attempt-Limit erreicht haben, werden
 *    endgültig auf 'failed' gesetzt (reine Aufräum-/Terminierung, kein Versandversuch).
 * 2. Bis zu MAX_MATCH_EMAILS_PER_RUN aktuell retryfähige Notifications werden ermittelt
 *    (Rate-Limit pro Lauf, Phase 3.6F §17) – der Rest bleibt retryfähig für den nächsten Lauf.
 * 3. sendMatchNotificationEmails() verarbeitet genau diese Kandidaten.
 */
export async function runMatchEmailRetryBatch(): Promise<RetryBatchResult> {
  await finalizeExhaustedStaleSendingRows()

  const candidateIds = await getEmailRetryCandidateIds(MAX_MATCH_EMAILS_PER_RUN)
  if (candidateIds.length === 0) {
    return { candidateCount: 0, outcomes: [] }
  }

  const outcomes = await sendMatchNotificationEmails(candidateIds)
  return { candidateCount: candidateIds.length, outcomes }
}

/**
 * Wählt bis zu `limit` aktuell retryfähige Notification-IDs aus, älteste zuerst (faire
 * Verarbeitungsreihenfolge). Dieselbe Eligibility-Bedingung wie der atomare Claim in
 * send-match-notification-emails.ts (pending ODER backoff-abgelaufenes failed ODER
 * lease-abgelaufenes sending) – hier nur zur AUSWAHL, nicht zur Sperre; die tatsächliche,
 * race-sichere Entscheidung trifft weiterhin ausschließlich der atomare Claim danach.
 */
export async function getEmailRetryCandidateIds(limit: number): Promise<string[]> {
  const db = getDb()
  const [backoffAfterAttempt1, backoffAfterAttempt2] = MATCH_EMAIL_BACKOFF_SECONDS
  const result = await db.query<{ id: string }>(
    `SELECT id FROM match_notifications
     WHERE status = 'pending'
        OR (
          status = 'failed' AND attempts < $1
          AND processing_started_at <= now() - (CASE attempts WHEN 1 THEN $2 WHEN 2 THEN $3 ELSE $3 END * interval '1 second')
        )
        OR (
          status = 'sending' AND attempts < $1
          AND processing_started_at <= now() - ($4 * interval '1 second')
        )
     ORDER BY created_at ASC
     LIMIT $5`,
    [MAX_MATCH_EMAIL_ATTEMPTS, backoffAfterAttempt1, backoffAfterAttempt2, MATCH_EMAIL_LEASE_SECONDS, limit]
  )
  return result.rows.map((row) => row.id)
}

/**
 * Terminiert 'sending'-Zeilen, deren Lease abgelaufen ist UND die bereits ihr Attempt-Limit
 * erreicht haben, auf 'failed' – ohne erneuten Versandversuch (der Claim würde sie wegen
 * attempts >= MAX ohnehin nie mehr aufgreifen, sie blieben sonst aber für immer sichtbar als
 * 'sending' hängen, was weder korrekt noch beobachtbar wäre). Reine Zustands-Bereinigung, kein
 * E-Mail-Versand, keine Auswirkung auf Matching/Job/Dashboard.
 */
async function finalizeExhaustedStaleSendingRows(): Promise<void> {
  const db = getDb()
  await db.query(
    `UPDATE match_notifications
     SET status = 'failed', last_error = COALESCE(last_error, $2)
     WHERE status = 'sending' AND attempts >= $1
       AND processing_started_at <= now() - ($3 * interval '1 second')`,
    [MAX_MATCH_EMAIL_ATTEMPTS, 'Maximale Anzahl an Versandversuchen erreicht (Lease abgelaufen).', MATCH_EMAIL_LEASE_SECONDS]
  )
}
