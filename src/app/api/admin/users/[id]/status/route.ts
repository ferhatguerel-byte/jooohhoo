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

    // Matching-Lifecycle (Phase C): eine Reaktivierung kann den Provider (dessen offene
    // Match-Snapshots wegen account_inactive bisher excluded=true waren) neu qualifizieren –
    // best-effort/isoliert, siehe profile/route.ts für dieselbe Begründung.
    if (status === 'active') {
      try {
        await matchProviderAgainstOpenJobs(userId)
      } catch (err) {
        console.error('Provider-Matching nach Reaktivierung fehlgeschlagen:', userId, err)
        captureError(err, { userId, operation: 'provider_matching_after_reactivation' })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    return handleApiError(err, 'Aktion fehlgeschlagen.')
  }
}
