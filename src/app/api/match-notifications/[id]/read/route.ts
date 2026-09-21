import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getCurrentUser } from '@/lib/current-user'
import { handleApiError } from '@/lib/api-error'
import { ANALYTICS_EVENTS } from '@/lib/analytics'
import { trackEvent } from '@/lib/analytics-events'

/**
 * Phase 3.6E – markiert eine eigene match_notification als gelesen. Einzige Autorisierung:
 * provider_id = authentifizierte Session-ID im WHERE, niemals aus dem Request übernommen –
 * verhindert, dass ein Provider fremde Notifications als gelesen markiert (IDOR-Schutz).
 *
 * COALESCE(read_at, now()) statt now(): eine bereits gelesene Notification behält ihren
 * ursprünglichen Zeitpunkt, ein zweiter Aufruf ist folgenlos wiederholbar (idempotent).
 *
 * Ändert AUSSCHLIESSLICH read_at. Kein E-Mail-Versand, kein Matching, keine Änderung an
 * status/attempts/last_error/sent_at/match_score/job_match_id (Phase 3.6E §13).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user || user.role !== 'subunternehmer') {
    return NextResponse.json({ error: 'Kein Zugriff.' }, { status: 403 })
  }

  try {
    // Phase 3.6G: (read_at = now()) erkennt zuverlässig den ERSTEN tatsächlichen Übergang
    // NULL -> jetzt: now() liefert innerhalb EINES Statements/derselben Transaktion immer denselben
    // Wert (Postgres now() = Transaktionsstart, stabil). War read_at bereits vorher gesetzt, ist
    // der gespeicherte (ältere) Zeitstempel zwangsläufig != dieser Transaktion now() -> false. Die
    // bestehende COALESCE-Semantik (Zeile darunter) bleibt dabei komplett unverändert.
    const result = await getDb().query<{ id: string; job_id: string; just_read: boolean }>(
      `UPDATE match_notifications SET read_at = COALESCE(read_at, now())
       WHERE id = $1 AND provider_id = $2
       RETURNING id, job_id, (read_at = now()) AS just_read`,
      [id, user.id]
    )
    // Bewusst derselbe 404 für "existiert nicht" und "gehört einem anderen Provider" – kein
    // Hinweis, ob eine fremde Notification-ID überhaupt existiert (IDOR-sicher).
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Nicht gefunden.' }, { status: 404 })
    }

    // MATCH_NOTIFICATION_READ nur beim ersten tatsächlichen Lesen (Phase 3.6G Teil 7) – provider_id
    // kommt ausschließlich aus der Session (derselbe IDOR-Schutz wie oben gilt unverändert für
    // diesen Analytics-Aufruf, keine zusätzliche Rechteausweitung). Eigenes try/catch: ein
    // Analytics-Fehler HIER darf niemals eine bereits erfolgreiche Read-Markierung als Fehler an
    // den Client zurückmelden (die COALESCE-UPDATE ist zu diesem Zeitpunkt bereits committed).
    if (result.rows[0].just_read) {
      try {
        await trackEvent({
          event: ANALYTICS_EVENTS.MATCH_NOTIFICATION_READ,
          actorUserId: user.id,
          providerId: user.id,
          jobId: result.rows[0].job_id,
          notificationId: id,
          idempotencyKey: `match_notification_read:${id}`,
        })
      } catch (analyticsError) {
        console.error('MATCH_NOTIFICATION_READ-Analytics fehlgeschlagen:', id, analyticsError)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    return handleApiError(err, 'Konnte nicht als gelesen markiert werden.')
  }
}
