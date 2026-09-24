import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { requireAdminApi } from '@/lib/authorization'
import { handleApiError } from '@/lib/api-error'
import { logAdminAction } from '@/lib/admin-audit'
import { GEWERKE } from '@/lib/gewerke'
import { matchProviderAgainstOpenJobs } from '@/lib/matching/run-provider-matching'
import { captureError } from '@/lib/observability/sentry'

const schema = z.object({ gewerk: z.enum(GEWERKE), blocked: z.boolean() })

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: userId } = await params
  try {
    const admin = await requireAdminApi()
    const { gewerk, blocked } = schema.parse(await req.json())
    const db = getDb()

    if (blocked) {
      await db.query(
        `UPDATE users SET blocked_gewerke = array_append(blocked_gewerke, $1)
         WHERE id = $2 AND NOT ($1 = ANY(blocked_gewerke))`,
        [gewerk, userId]
      )
    } else {
      await db.query(
        `UPDATE users SET blocked_gewerke = array_remove(blocked_gewerke, $1) WHERE id = $2`,
        [gewerk, userId]
      )
    }

    await logAdminAction(admin.id, blocked ? 'GEWERK_BLOCKED' : 'GEWERK_UNBLOCKED', 'user', userId, { gewerk }, req)

    // Matching-Lifecycle (Phase C) – dieselbe Re-Matching-Funktion für beide Richtungen, keine
    // zweite Invalidierungslogik nötig: matchProviderAgainstOpenJobs() ruft intern erneut
    // filterProviderForJob() auf, das blockedGewerke bereits prüft (hard-filter.ts).
    // - Entsperren: der Job war/ist bereits über sein Gewerk in der SQL-Kandidatenmenge
    //   (provider-candidate-jobs.ts filtert nicht nach blocked_gewerke) – der Hard Filter lässt
    //   ihn jetzt zusätzlich durch, ein neuer Match/eine neue Notification kann entstehen.
    // - Sperren: derselbe Job bleibt weiterhin in der SQL-Kandidatenmenge (Gewerk ändert sich
    //   nicht), der Hard Filter schließt ihn jetzt aber aus -> das UPSERT schreibt excluded=true
    //   in job_matches, wodurch /dashboard/passende-auftraege ihn nicht mehr anzeigt.
    // match_notifications bleibt in beiden Fällen unverändert (historisches Ereignis).
    // Best-effort/isoliert – ein Fehler hier darf die bereits erfolgreiche Admin-Aktion niemals
    // rückgängig machen oder den Request fehlschlagen lassen.
    try {
      await matchProviderAgainstOpenJobs(userId)
    } catch (err) {
      console.error('Provider-Matching nach Gewerke-Sperr-/Freigabe-Änderung fehlgeschlagen:', userId, err)
      captureError(err, { userId, operation: 'provider_matching_after_gewerk_block_change' })
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    return handleApiError(err, 'Aktion fehlgeschlagen.')
  }
}
