import { getDb } from '@/lib/db'
import { MATCH_NOTIFICATION_THRESHOLD } from '@/lib/matching/score-config'
import { ANALYTICS_EVENTS } from '@/lib/analytics'
import { trackEventsBatch } from '@/lib/analytics-events'
import { captureError } from '@/lib/observability/sentry'

export interface CreateMatchNotificationsResult {
  /** Anzahl tatsächlich neu angelegter Zeilen (0 bei einem reinen Re-Run ohne neue Treffer). */
  createdCount: number
  /**
   * IDs der tatsächlich NEU angelegten Zeilen (nicht der bereits vorhandenen). Phase 3.6D nutzt
   * ausschließlich diese Liste als Versandkandidaten – ein Re-Matching, das wegen ON CONFLICT DO
   * NOTHING keine neuen Zeilen erzeugt, darf auch keine E-Mail erneut auslösen.
   */
  createdIds: string[]
}

/**
 * Phase 3.6C – wählt aus den AKTUELLEN job_matches-Snapshots (Phase 3.5, bereits durch
 * runMatchingForJob() persistiert) die Provider aus, die den Notification-Threshold erreichen,
 * und legt für sie genau eine match_notifications-Zeile an. Berechnet nichts selbst – job_matches
 * ist die alleinige Quelle, keine zweite Hard-Filter- oder Score-Logik.
 *
 * Eligibility exakt wie in der Vorgabe, keine zusätzlichen Kriterien:
 *   excluded = false AND match_score IS NOT NULL AND match_score >= MATCH_NOTIFICATION_THRESHOLD
 *
 * PRODUKTLOGIK (wichtig, siehe Phase 3.6C §16): Eine Notification ist ein historisches Ereignis
 * ("dieser Provider wurde für diesen Job mindestens einmal als benachrichtigungswürdig erkannt"),
 * KEIN laufender Score-Snapshot. Deshalb:
 * - `ON CONFLICT (job_id, provider_id) DO NOTHING` statt `DO UPDATE`: eine bereits bestehende
 *   Notification wird durch einen erneuten runMatchingForJob()-Lauf NIE verändert – weder bei
 *   einer späteren Score-Verbesserung noch bei einem späteren Score-Abfall unter den Threshold.
 * - Der gespeicherte match_score/job_match_id ist ein SNAPSHOT zum Zeitpunkt der erstmaligen
 *   Erstellung, kein Live-Wert.
 * - Diese Garantie liegt auf DB-Ebene (UNIQUE(job_id, provider_id) aus Migration 0008 + ON
 *   CONFLICT), nicht nur in einer applikationsseitigen "if (!exists)"-Prüfung – race-condition-frei.
 *
 * Einziges Statement, unabhängig von der Providerzahl (Phase 3.6C §10: keine N+1-Struktur) – ein
 * INSERT ... SELECT ... WHERE statt einer Schleife über einzelne Kandidaten.
 */
export async function createMatchNotifications(jobId: string): Promise<CreateMatchNotificationsResult> {
  const db = getDb()
  const result = await db.query<{ id: string; provider_id: string }>(
    `INSERT INTO match_notifications (job_id, provider_id, job_match_id, match_score)
     SELECT job_id, provider_id, id, match_score
     FROM job_matches
     WHERE job_id = $1
       AND excluded = false
       AND match_score IS NOT NULL
       AND match_score >= $2
     ON CONFLICT (job_id, provider_id) DO NOTHING
     RETURNING id, provider_id`,
    [jobId, MATCH_NOTIFICATION_THRESHOLD]
  )
  const createdIds = result.rows.map((row) => row.id)

  // Phase 3.6G: MATCH_NOTIFICATION_CREATED NUR für tatsächlich neu eingefügte Zeilen (bereits
  // durch RETURNING garantiert – ein per ON CONFLICT DO NOTHING übersprungener Re-Run taucht hier
  // nicht auf). Ein gebatchter INSERT für alle neuen Notifications dieses Laufs, kein Insert pro
  // Notification. threshold kommt aus der zentralen Konfiguration, keine Magic Number.
  if (result.rows.length > 0) {
    try {
      await trackEventsBatch(
        result.rows.map((row) => ({
          event: ANALYTICS_EVENTS.MATCH_NOTIFICATION_CREATED,
          jobId,
          providerId: row.provider_id,
          notificationId: row.id,
          metadata: { threshold: MATCH_NOTIFICATION_THRESHOLD },
          idempotencyKey: `match_notification_created:${row.id}`,
        }))
      )
    } catch (analyticsError) {
      console.error('MATCH_NOTIFICATION_CREATED-Analytics fehlgeschlagen:', jobId, analyticsError)
      captureError(analyticsError, { jobId, operation: 'match_notification_created_analytics' })
    }
  }

  return { createdCount: createdIds.length, createdIds }
}
