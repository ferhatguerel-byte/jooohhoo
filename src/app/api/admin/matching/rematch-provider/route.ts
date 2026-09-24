import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminApi } from '@/lib/authorization'
import { handleApiError } from '@/lib/api-error'
import { logAdminAction } from '@/lib/admin-audit'
import { matchProviderAgainstOpenJobs } from '@/lib/matching/run-provider-matching'

const schema = z.object({ providerId: z.string().uuid() })

/**
 * Matching-Lifecycle – Backfill für bereits bestehende Handwerker (Soft-Launch-Umfang): stößt
 * matchProviderAgainstOpenJobs() für GENAU EINEN, explizit angegebenen Provider an. Bewusst kein
 * automatisches Massenmatching über alle Provider – für den Soft Launch reicht eine sichere
 * Möglichkeit, einen einzelnen Provider (z.B. bei einer Support-Anfrage) gegen alle aktuell
 * offenen Aufträge neu zu matchen.
 *
 * requireAdminApi() ist die einzige Zugriffskontrolle – ohne gültige Admin-Session ist dieser
 * Endpunkt nicht erreichbar (403), analog zu admin/verify und admin/users/[id]/status.
 */
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdminApi()
    const { providerId } = schema.parse(await req.json())

    const result = await matchProviderAgainstOpenJobs(providerId)

    await logAdminAction(
      admin.id,
      'PROVIDER_REMATCHED',
      'user',
      providerId,
      { resultCount: result.resultCount, eligibleCount: result.eligibleCount, excludedCount: result.excludedCount },
      req
    )

    return NextResponse.json({ ok: true, ...result })
  } catch (err: unknown) {
    return handleApiError(err, 'Re-Matching fehlgeschlagen.')
  }
}
