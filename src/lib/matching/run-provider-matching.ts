import { getDb } from '@/lib/db'
import { getScoredJobsForProvider } from '@/lib/matching/scored-jobs'
import { buildJobMatchesUpsertQuery } from '@/lib/matching/run-matching'
import { createMatchNotificationsForProvider } from '@/lib/matching/create-match-notifications'
import { sendMatchNotificationEmails } from '@/lib/matching/send-match-notification-emails'
import { ANALYTICS_EVENTS } from '@/lib/analytics'
import { trackEventsBatch } from '@/lib/analytics-events'
import { captureError } from '@/lib/observability/sentry'

export interface RunProviderMatchingResult {
  providerId: string
  /** Anzahl der Provider×Job-Kombinationen, die als aktueller Snapshot geschrieben wurden. */
  resultCount: number
  eligibleCount: number
  excludedCount: number
}

/**
 * Matching-Lifecycle – provider-zentriertes Gegenstück zu runMatchingForJob(): wird best-effort
 * ausgelöst, wenn sich für einen Provider matching-relevante Eigenschaften ändern
 * (Abo-Aktivierung, Profil-Update, Verifizierung, Reaktivierung), sowie manuell über den
 * Admin-Backfill-Endpunkt für bereits bestehende Handwerker. Berechnet nichts selbst – ruft
 * ausschließlich die bestehende Pipeline auf (getScoredJobsForProvider, buildJobMatchesUpsertQuery,
 * createMatchNotificationsForProvider, sendMatchNotificationEmails) und schreibt deren Ergebnis.
 * Keine zweite Hard-Filter- oder Score-Logik, keine zweite job_matches-/match_notifications-Struktur.
 *
 * Bewusst KEIN DELETE veralteter Zeilen (anders als runMatchingForJob()): dort entfernt das DELETE
 * Provider, die die SQL-Vorfilterung eines Jobs nicht mehr erreichen. Hier wird die Provider-Zeile
 * dagegen IMMER vollständig geladen (fetchProviderAndCandidateJobs lädt sie unabhängig vom
 * Hard-Filter-Ergebnis) – eine Verschlechterung des Profils wird bereits durch das UPSERT selbst
 * korrekt als excluded=true abgebildet (siehe die Invalidierungs-Union in
 * provider-candidate-jobs.ts), ein zusätzliches DELETE wäre hier ohne Nutzen.
 *
 * Race Conditions: mehrere parallele Aufrufe für denselben Provider (z.B. Webhook-Retry und
 * gleichzeitiges Profil-Update) sind unschädlich – jeder Lauf berechnet unabhängig den aktuellen
 * Zustand und schreibt ihn per ON CONFLICT DO UPDATE; der jeweils zuletzt committende Lauf gewinnt,
 * es entsteht nie ein inkonsistenter Zwischenzustand (dieselbe Eigenschaft wie bei
 * runMatchingForJob(), siehe dort). Notifications bleiben durch ON CONFLICT DO NOTHING
 * (UNIQUE(job_id, provider_id)) auch bei parallelen Läufen dupliktfrei.
 */
export async function matchProviderAgainstOpenJobs(providerId: string): Promise<RunProviderMatchingResult> {
  const results = await getScoredJobsForProvider(providerId)

  if (results.length > 0) {
    const db = getDb()
    const { sql, params } = buildJobMatchesUpsertQuery(
      results.map((result) => ({
        jobId: result.jobId,
        providerId,
        eligible: result.eligible,
        score: result.score,
        exclusionReason: result.exclusionReason,
      }))
    )
    await db.query(sql, params)
  }

  const eligibleResults = results.filter((r) => r.eligible)
  if (eligibleResults.length > 0) {
    try {
      await trackEventsBatch(
        eligibleResults.map((r) => ({
          event: ANALYTICS_EVENTS.MATCH_CREATED,
          jobId: r.jobId,
          providerId,
          // Gleiches idempotencyKey-Format wie in run-matching.ts – dieselbe Job×Provider-
          // Kombination erzeugt unabhängig davon, ob sie über den job- oder den provider-
          // zentrierten Pfad neu berechnet wurde, nie ein zweites MATCH_CREATED-Event.
          idempotencyKey: `match_created:${r.jobId}:${providerId}`,
        }))
      )
    } catch (analyticsError) {
      console.error('MATCH_CREATED-Analytics für Provider-Matching-Lauf fehlgeschlagen:', providerId, analyticsError)
      captureError(analyticsError, { userId: providerId, operation: 'match_created_analytics' })
    }
  }

  try {
    const { createdIds } = await createMatchNotificationsForProvider(providerId)
    if (createdIds.length > 0) {
      await sendMatchNotificationEmails(createdIds)
    }
  } catch (notificationError) {
    console.error('Notification-Erstellung/-Versand für Provider-Matching-Lauf fehlgeschlagen:', providerId, notificationError)
    captureError(notificationError, { userId: providerId, operation: 'match_notification_pipeline' })
  }

  return {
    providerId,
    resultCount: results.length,
    eligibleCount: results.filter((r) => r.eligible).length,
    excludedCount: results.filter((r) => !r.eligible).length,
  }
}
