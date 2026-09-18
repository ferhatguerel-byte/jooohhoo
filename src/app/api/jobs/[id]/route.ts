import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { getCurrentUser } from '@/lib/current-user'

const updateSchema = z.object({
  title: z.string().min(5),
  description: z.string().min(20),
  deadline: z.string().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user || user.role !== 'auftraggeber') {
    return NextResponse.json({ error: 'Nur Auftraggeber können Aufträge bearbeiten.' }, { status: 403 })
  }

  try {
    const body = updateSchema.parse(await req.json())
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
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message || 'Ungültige Eingabe.' }, { status: 400 })
    }
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    console.error('Auftrag bearbeiten Fehler:', message)
    return NextResponse.json({ error: 'Auftrag konnte nicht aktualisiert werden.' }, { status: 500 })
  }
}
