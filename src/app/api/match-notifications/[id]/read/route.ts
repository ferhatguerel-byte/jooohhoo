import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getCurrentUser } from '@/lib/current-user'
import { handleApiError } from '@/lib/api-error'

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
    const result = await getDb().query(
      `UPDATE match_notifications SET read_at = COALESCE(read_at, now())
       WHERE id = $1 AND provider_id = $2
       RETURNING id`,
      [id, user.id]
    )
    // Bewusst derselbe 404 für "existiert nicht" und "gehört einem anderen Provider" – kein
    // Hinweis, ob eine fremde Notification-ID überhaupt existiert (IDOR-sicher).
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Nicht gefunden.' }, { status: 404 })
    }
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    return handleApiError(err, 'Konnte nicht als gelesen markiert werden.')
  }
}
