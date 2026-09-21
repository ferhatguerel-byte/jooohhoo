import { getDb } from '@/lib/db'
import { getScoredProvidersForJob, type ScoredProviderResult } from '@/lib/matching/scored-providers'
import { createMatchNotifications } from '@/lib/matching/create-match-notifications'
import { sendMatchNotificationEmails } from '@/lib/matching/send-match-notification-emails'
import { ANALYTICS_EVENTS } from '@/lib/analytics'
import { trackEventsBatch } from '@/lib/analytics-events'

/**
 * Phase 3.5 – Matching Engine: Match Storage/Persistence.
 *
 * runMatchingForJob(jobId) führt die vollständige Pipeline aus Phase 3.3/3.4 aus
 * (Hard Filter → Batch Metrics → Pure Scoring, komplett über die bestehende
 * getScoredProvidersForJob()) und persistiert das Ergebnis als aktuellen Snapshot in
 * job_matches. Keine zweite Hard-Filter- oder Score-Logik – diese Funktion berechnet nichts
 * selbst, sie ruft nur die bestehende Pipeline auf und schreibt deren Ergebnis.
 *
 * Bleibt eine rein interne Funktion; einzige Aufrufstelle im Produktcode ist POST /api/jobs
 * (Phase 3.6A, best-effort nach dem Job-Commit) – kein Cronjob, keine Queue.
 *
 * Seit Phase 3.6C: nach dem erfolgreichen Matching-Commit wird zusätzlich
 * createMatchNotifications(jobId) aufgerufen (Pipeline: persist job_matches → createMatchNotifications
 * → INSERT eligible notifications), ebenfalls best-effort/isoliert – siehe unten.
 */

export interface RunMatchingResult {
  jobId: string
  /** Anzahl der Job×Provider-Kombinationen, die als aktueller Snapshot geschrieben wurden. */
  resultCount: number
  eligibleCount: number
  excludedCount: number
}

/**
 * Snapshot-Strategie (Phase 3.5 §22, Option B): aktuelle Kandidaten werden per Bulk-UPSERT
 * geschrieben, danach werden alle job_matches-Zeilen für diesen Job GELÖSCHT, deren provider_id
 * NICHT mehr in der aktuellen Kandidatenmenge ist. So bleibt garantiert nie ein veralteter Match
 * eines Providers bestehen, der beim aktuellen Lauf gar nicht mehr die SQL-Vorfilterung erreicht
 * (z.B. weil er sein Abo gekündigt hat oder das Gewerk nicht mehr führt). Option B statt "alles
 * löschen und neu schreiben" (Option A), weil sich beides in einer einzigen kurzen Transaktion
 * sauber und atomar umsetzen lässt und Option B keine unnötige Zeilen-Churn erzeugt (UPDATE statt
 * DELETE+INSERT für unveränderte Kombinationen) – wichtig, da calculated_at sonst bei jedem Lauf
 * für ALLE Zeilen springen würde, auch wenn sich nichts geändert hat.
 *
 * Berechnung (getScoredProvidersForJob, inkl. aller DB-Lesezugriffe für Job/Kandidaten/Metriken)
 * läuft bewusst VOR dem Transaktionsstart – die Transaktion selbst enthält nur die beiden
 * Schreiboperationen (Bulk-UPSERT + gezieltes DELETE), damit sie so kurz wie möglich bleibt.
 */
export async function runMatchingForJob(jobId: string): Promise<RunMatchingResult> {
  const results = await getScoredProvidersForJob(jobId)

  const db = getDb()
  const client = await db.connect()
  try {
    await client.query('BEGIN')

    if (results.length > 0) {
      const { sql, params } = buildUpsertQuery(jobId, results)
      await client.query(sql, params)
    }

    const currentProviderIds = results.map((r) => r.providerId)
    // provider_id != ALL($2) ist bei leerem Array vacuously true für jede Zeile -> löscht bei
    // 0 aktuellen Kandidaten korrekt ALLE bisherigen Matches für diesen Job (Phase 3.5 §8: ein
    // Job darf 0 Matches haben, der gespeicherte Zustand muss das widerspiegeln).
    await client.query(`DELETE FROM job_matches WHERE job_id = $1 AND provider_id != ALL($2::uuid[])`, [
      jobId,
      currentProviderIds,
    ])

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }

  // Phase 3.6G: MATCH_CREATED wird NACH dem erfolgreichen Commit für jeden tatsächlich eligiblen
  // (nicht ausgeschlossenen) Provider persistiert – ein Exklusionsergebnis ist fachlich kein
  // "Match". EIN gebatchter INSERT für alle Provider dieses Laufs (kein Insert pro Provider,
  // Phase 3.6G Teil 11). trackEventsBatch() fängt DB-Fehler bereits selbst ab; das try/catch hier
  // ist zusätzliche Verteidigung in der Tiefe (derselbe Stil wie das Notification-/E-Mail-
  // best-effort-Muster direkt darunter) – ein Analytics-Fehler darf den bereits erfolgreichen
  // Matching-Commit niemals rückgängig machen oder runMatchingForJob() fehlschlagen lassen.
  // idempotencyKey verhindert doppelte Events bei einem erneuten runMatchingForJob()-Lauf für
  // dieselbe Job×Provider-Kombination (z.B. unveränderter Re-Match). Keine Scores/Exclusion-
  // Details in den Metadaten (Phase 3.6G Datenschutz-Vorgabe).
  const eligibleResults = results.filter((r) => r.eligible)
  if (eligibleResults.length > 0) {
    try {
      await trackEventsBatch(
        eligibleResults.map((r) => ({
          event: ANALYTICS_EVENTS.MATCH_CREATED,
          jobId,
          providerId: r.providerId,
          idempotencyKey: `match_created:${jobId}:${r.providerId}`,
        }))
      )
    } catch (analyticsError) {
      console.error('MATCH_CREATED-Analytics für Matching-Lauf fehlgeschlagen:', jobId, analyticsError)
    }
  }

  // Matching ist an dieser Stelle bereits erfolgreich committed (Phase 3.6C §8/§9): Notification-
  // Erstellung und (seit Phase 3.6D) der E-Mail-Versand für NEU erzeugte Notifications sind ein
  // nachgelagerter, ISOLIERTER Schritt. Ein Fehler hier darf weder den bereits erfolgreichen
  // Matching-Lauf rückgängig machen noch runMatchingForJob() insgesamt fehlschlagen lassen –
  // exakt dieselbe Best-Effort-Isolierung wie der äußere Aufruf aus POST /api/jobs (Phase 3.6A).
  // Deshalb wird hier gefangen statt weitergeworfen. sendMatchNotificationEmails() erhält
  // ausschließlich createdIds (nicht "alle pending") – ein Re-Matching ohne neue Treffer
  // (ON CONFLICT DO NOTHING) löst dadurch garantiert keinen erneuten Versand aus (Phase 3.6D §17).
  try {
    const { createdIds } = await createMatchNotifications(jobId)
    if (createdIds.length > 0) {
      await sendMatchNotificationEmails(createdIds)
    }
  } catch (notificationError) {
    console.error('Notification-Erstellung/-Versand für Matching-Lauf fehlgeschlagen:', jobId, notificationError)
  }

  return {
    jobId,
    resultCount: results.length,
    eligibleCount: results.filter((r) => r.eligible).length,
    excludedCount: results.filter((r) => !r.eligible).length,
  }
}

/**
 * Baut ein einziges Bulk-INSERT ... VALUES (...),(...) ... ON CONFLICT DO UPDATE für alle
 * aktuellen Ergebnisse (Phase 3.5 §17/§24: kein Insert pro Provider, keine Schleife). Vollständig
 * parametrisiert – keine Nutzereingabe wird in den SQL-Text interpoliert.
 *
 * matched_factors/missing_data enthalten für ausgeschlossene Provider bewusst leere Objekte
 * ({}/[]) statt erfundener Werte – es gibt für sie keine Score-Berechnung. Die globale
 * Score-Konfiguration (Gewichte) wird nirgends dupliziert, nur das berechnete Ergebnis.
 */
function buildUpsertQuery(jobId: string, results: ScoredProviderResult[]): { sql: string; params: unknown[] } {
  const rows: string[] = []
  const params: unknown[] = []

  results.forEach((result, index) => {
    const base = index * 7
    rows.push(`($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},now())`)
    params.push(
      jobId,
      result.providerId,
      result.eligible ? result.score!.score : null,
      JSON.stringify(result.eligible ? result.score!.breakdown : {}),
      JSON.stringify(result.eligible ? result.score!.missingData : []),
      !result.eligible,
      result.eligible ? null : result.exclusionReason
    )
  })

  const sql = `
    INSERT INTO job_matches (job_id, provider_id, match_score, matched_factors, missing_data, excluded, exclusion_reason, calculated_at)
    VALUES ${rows.join(',')}
    ON CONFLICT (job_id, provider_id) DO UPDATE SET
      match_score = EXCLUDED.match_score,
      matched_factors = EXCLUDED.matched_factors,
      missing_data = EXCLUDED.missing_data,
      excluded = EXCLUDED.excluded,
      exclusion_reason = EXCLUDED.exclusion_reason,
      calculated_at = EXCLUDED.calculated_at
  `

  return { sql, params }
}
