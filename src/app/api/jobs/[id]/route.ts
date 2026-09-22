import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { getCurrentUser } from '@/lib/current-user'
import { handleApiError } from '@/lib/api-error'
import { rateLimit } from '@/lib/security/rate-limit'
import { readJsonBody } from '@/lib/security/request-limits'

// Phase 4.3 (Teil D): title/description hatten bisher nur eine Mindestlänge (siehe /api/jobs).
const updateSchema = z.object({
  title: z.string().min(5).max(200),
  description: z.string().min(20).max(5000),
  deadline: z.string().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user || user.role !== 'auftraggeber') {
    return NextResponse.json({ error: 'Nur Auftraggeber können Aufträge bearbeiten.' }, { status: 403 })
  }

  try {
    const body = updateSchema.parse(await readJsonBody(req))

    // Phase 4.3: dieselbe Größenordnung wie die Job-Erstellung (Teil 2/A) – auch wiederholtes
    // Bearbeiten desselben Auftrags soll nicht unbegrenzt möglich sein.
    await rateLimit({ key: `jobs-update:${user.id}`, limit: 20, windowSeconds: 3600 })

    const db = getDb()

    const jobResult = await db.query(
      'SELECT awarded_subunternehmer_id FROM jobs WHERE id = $1 AND auftraggeber_id = $2',
      [id, user.id]
    )
    if (jobResult.rows.length === 0) {
      return NextResponse.json({ error: 'Auftrag nicht gefunden.' }, { status: 404 })
    }
    if (jobResult.rows[0].awarded_subunternehmer_id) {
      return NextResponse.json({ error: 'Ein bereits vergebener Auftrag kann nicht mehr bearbeitet werden.' }, { status: 409 })
    }

    await db.query(
      'UPDATE jobs SET title = $1, description = $2, deadline = $3 WHERE id = $4',
      [body.title, body.description, body.deadline || null, id]
    )
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    return handleApiError(err, 'Auftrag konnte nicht aktualisiert werden.')
  }
}
