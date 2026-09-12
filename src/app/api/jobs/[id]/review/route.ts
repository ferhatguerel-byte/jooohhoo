import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { getCurrentUser } from '@/lib/current-user'

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: jobId } = await params
  const user = await getCurrentUser()
  if (!user || user.role !== 'auftraggeber') {
    return NextResponse.json({ error: 'Nur Auftraggeber können nach Auftragsvergabe bewerten.' }, { status: 403 })
  }

  try {
    const { rating, comment } = reviewSchema.parse(await req.json())
    const db = getDb()

    const job = await db.query(
      'SELECT awarded_subunternehmer_id FROM jobs WHERE id = $1 AND auftraggeber_id = $2',
      [jobId, user.id]
    )
    const revieweeId = job.rows[0]?.awarded_subunternehmer_id
    if (!revieweeId) {
      return NextResponse.json({ error: 'Für diesen Auftrag wurde noch kein Subunternehmer beauftragt.' }, { status: 400 })
    }

    await db.query(
      `INSERT INTO reviews (job_id, reviewer_id, reviewee_id, rating, comment)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (job_id, reviewer_id, reviewee_id) DO UPDATE SET rating = $4, comment = $5`,
      [jobId, user.id, revieweeId, rating, comment || null]
    )

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message || 'Ungültige Eingabe.' }, { status: 400 })
    }
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    console.error('Bewertung Fehler:', message)
    return NextResponse.json({ error: 'Bewertung konnte nicht gespeichert werden.' }, { status: 500 })
  }
}
