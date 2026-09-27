import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { requireAdminApi } from '@/lib/authorization'
import { handleApiError } from '@/lib/api-error'
import { logAdminAction } from '@/lib/admin-audit'
import { matchProviderAgainstOpenJobs } from '@/lib/matching/run-provider-matching'
import { captureError } from '@/lib/observability/sentry'

const schema = z.object({ status: z.enum(['active', 'suspended']) })

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: userId } = await params
  try {
    const admin = await requireAdminApi()
    const { status } = schema.parse(await req.json())
    await getDb().query('UPDATE users SET account_status = $1 WHERE id = $2', [status, userId])
    await logAdminAction(admin.id, status === 'suspended' ? 'USER_SUSPENDED' : 'USER_UNSUSPENDED', 'user', userId, {}, req)

    // Matching-Lifecycle: sowohl Reaktivierung als auch Sperrung lösen ein Re-Matching aus.
    // - Reaktivierung: der Provider (dessen offene Match-Snapshots wegen account_inactive
    //   bisher excluded=true waren) kann neu qualifizieren, siehe profile/route.ts für dieselbe
    //   Begründung.
    // - Sperrung: matchProviderAgainstOpenJobs() ruft intern erneut filterProviderForJob() auf,
    //   das accountStatus bereits prüft (hard-filter.ts) – bestehende, aktuell gültige Matches
    //   werden dadurch korrekt als excluded=true zurückgeschrieben (job_matches-Snapshot), ohne
    //   dass eine zweite Invalidierungslogik nötig ist. match_notifications bleiben als
    //   historische Ereignisse unangetastet, bereits abgegebene Angebote (offers) sowieso.
    // Best-effort/isoliert in beiden Fällen – ein Fehler hier darf die bereits erfolgreiche
    // Statusänderung niemals rückgängig machen oder den Request fehlschlagen lassen.
    try {
      await matchProviderAgainstOpenJobs(userId)
    } catch (err) {
      console.error('Provider-Matching nach Statusänderung fehlgeschlagen:', userId, status, err)
      captureError(err, { userId, operation: 'provider_matching_after_status_change' })
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    return handleApiError(err, 'Aktion fehlgeschlagen.')
  }
}
