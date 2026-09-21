import { getDb } from '@/lib/db'
import { type AnalyticsEvent } from '@/lib/analytics'

/**
 * Phase 3.6G – First-Party-Matching-Funnel-Analytics, persistiert in `analytics_events`
 * (Migration 0010). SERVERSEITIG-NUR: importiert `@/lib/db` (rohes `pg`), darf NIE aus einer
 * 'use client'-Datei importiert werden (siehe Kommentar in src/lib/analytics.ts für die
 * Begründung, warum dies eine eigene Datei ist statt einer Erweiterung von `track()`).
 *
 * Best-effort wie jede andere Analytics-/Notification-Operation in dieser Codebasis (siehe z.B.
 * run-matching.ts): ein Fehler beim Schreiben eines Analytics-Events darf NIE einen Kernfluss
 * (Auftragserstellung, Matching, Notification-Erzeugung, E-Mail-Versand, Angebotserstellung,
 * Auftragsvergabe) stören. Beide Funktionen unten fangen daher jeden Fehler intern und werfen
 * nie – ein `await trackEvent(...)` an einer Aufrufstelle kann also nie eine Exception nach oben
 * durchreichen. Aufrufstellen umschließen den Aufruf trotzdem zusätzlich mit try/catch, wo es dem
 * bestehenden Codestil (explizite Sichtbarkeit von "das ist best-effort") entspricht.
 *
 * IDEMPOTENZ: ein optionaler `idempotencyKey` wird über die UNIQUE-Constraint auf
 * `analytics_events.idempotency_key` (Migration 0010) plus `ON CONFLICT (idempotency_key) DO
 * NOTHING` durchgesetzt – race-condition-frei auf DB-Ebene, real gegen PostgreSQL mit zwei
 * parallelen Prozessen verifiziert (siehe Abschlussbericht). Events ohne fachlich sinnvolle
 * Einmaligkeit (aktuell: JOB_VIEWED) lassen idempotencyKey weg – mehrere NULL-Werte sind über
 * dieselbe UNIQUE-Constraint zulässig (NULL ist in PostgreSQL nie gleich NULL).
 */
export interface TrackEventInput {
  event: AnalyticsEvent
  actorUserId?: string | null
  jobId?: string | null
  providerId?: string | null
  notificationId?: string | null
  /** Nur unkritische, strukturierte Werte – keine PII (siehe src/lib/analytics.ts). */
  metadata?: Record<string, string | number | boolean | null>
  idempotencyKey?: string | null
}

/** Einzelnes Event. Für mehrere Events aus derselben Operation IMMER trackEventsBatch() nutzen
 * (Phase 3.6G Teil 11: keine N+1-Inserts, z.B. bei mehreren Matches/Notifications pro Job). */
export async function trackEvent(input: TrackEventInput): Promise<void> {
  await trackEventsBatch([input])
}

/**
 * Schreibt mehrere Analytics-Events in EINEM Bulk-INSERT (analog zum bestehenden Bulk-UPSERT-
 * Muster in run-matching.ts) – unabhängig von der Anzahl der Events genau eine DB-Query, kein
 * Insert pro Event.
 */
export async function trackEventsBatch(inputs: TrackEventInput[]): Promise<void> {
  if (inputs.length === 0) return

  try {
    const db = getDb()
    const rows: string[] = []
    const params: unknown[] = []

    inputs.forEach((input, index) => {
      const base = index * 7
      rows.push(`($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6}::jsonb,$${base + 7})`)
      params.push(
        input.event,
        input.actorUserId ?? null,
        input.jobId ?? null,
        input.providerId ?? null,
        input.notificationId ?? null,
        JSON.stringify(input.metadata ?? {}),
        input.idempotencyKey ?? null
      )
    })

    await db.query(
      `INSERT INTO analytics_events (event_type, actor_user_id, job_id, provider_id, notification_id, metadata, idempotency_key)
       VALUES ${rows.join(',')}
       ON CONFLICT (idempotency_key) DO NOTHING`,
      params
    )
  } catch (err) {
    // Analytics ist best-effort – ein DB-Fehler hier darf niemals den aufrufenden Geschäftsvorgang
    // stören. Keine E-Mail-Adressen/Secrets/personenbezogenen Daten im Log, nur Event-Typen.
    console.error(
      '[analytics-events] trackEventsBatch fehlgeschlagen (ignoriert, best-effort):',
      inputs.map((i) => i.event),
      err
    )
  }
}
