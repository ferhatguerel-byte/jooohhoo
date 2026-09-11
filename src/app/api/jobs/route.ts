import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { getCurrentUser } from '@/lib/current-user'
import { TIERS } from '@/lib/tiers'
import { GEWERKE } from '@/lib/gewerke'

const jobSchema = z.object({
  title: z.string().min(5),
  gewerk: z.enum(GEWERKE),
  plz: z.string().min(4),
  ort: z.string().min(2),
  description: z.string().min(20),
  budgetMin: z.number().int().positive().optional(),
  budgetMax: z.number().int().positive().optional(),
  deadline: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'auftraggeber') {
    return NextResponse.json({ error: 'Nur Auftraggeber können Aufträge einstellen.' }, { status: 403 })
  }

  if (user.subscriptionStatus !== 'active' || !user.subscriptionTier) {
    return NextResponse.json(
      { error: 'Bitte wählen Sie zuerst ein Abo, um Aufträge einzustellen.' },
      { status: 402 }
    )
  }

  try {
    const body = jobSchema.parse(await req.json())
    const db = getDb()

    const activeCount = await db.query(
      "SELECT COUNT(*)::int AS count FROM jobs WHERE auftraggeber_id = $1 AND status = 'open'",
      [user.id]
    )
    const limit = TIERS[user.subscriptionTier].maxActiveJobs
    if (activeCount.rows[0].count >= limit) {
      return NextResponse.json(
        { error: `Sie haben das Limit von ${limit} aktiven Aufträgen für Ihr ${TIERS[user.subscriptionTier].name}-Abo erreicht.` },
        { status: 402 }
      )
    }

    const result = await db.query(
      `INSERT INTO jobs (auftraggeber_id, title, gewerk, plz, ort, description, budget_min, budget_max, deadline)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        user.id,
        body.title,
        body.gewerk,
        body.plz,
        body.ort,
        body.description,
        body.budgetMin || null,
        body.budgetMax || null,
        body.deadline || null,
      ]
    )

    return NextResponse.json({ ok: true, id: result.rows[0].id })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message || 'Ungültige Eingabe.' }, { status: 400 })
    }
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    console.error('Auftrag erstellen Fehler:', message)
    return NextResponse.json({ error: 'Auftrag konnte nicht erstellt werden.' }, { status: 500 })
  }
}
