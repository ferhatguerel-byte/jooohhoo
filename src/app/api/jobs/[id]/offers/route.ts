import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { getCurrentUser } from '@/lib/current-user'
import { sendNewOfferEmail } from '@/lib/email'

const offerSchema = z.object({
  price: z.number().int().positive(),
  message: z.string().max(2000).optional(),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: jobId } = await params
  const user = await getCurrentUser()
  if (!user || user.role !== 'subunternehmer') {
    return NextResponse.json({ error: 'Nur Subunternehmer können Angebote abgeben.' }, { status: 403 })
  }

  try {
    const body = offerSchema.parse(await req.json())
    const db = getDb()

    const job = await db.query(
      `SELECT j.id, j.title, u.email
       FROM jobs j JOIN users u ON u.id = j.auftraggeber_id
       WHERE j.id = $1 AND j.status = 'open'`,
      [jobId]
    )
    if (job.rows.length === 0) {
      return NextResponse.json({ error: 'Auftrag nicht gefunden oder nicht mehr offen.' }, { status: 404 })
    }

    await db.query(
      `INSERT INTO offers (job_id, subunternehmer_id, price, message)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (job_id, subunternehmer_id) DO UPDATE SET price = $3, message = $4`,
      [jobId, user.id, body.price, body.message || null]
    )

    try {
      await sendNewOfferEmail(job.rows[0].email, job.rows[0].title, body.price, user.companyName)
    } catch (emailErr) {
      console.error('Benachrichtigung fehlgeschlagen:', emailErr)
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message || 'Ungültige Eingabe.' }, { status: 400 })
    }
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    console.error('Angebot abgeben Fehler:', message)
    return NextResponse.json({ error: 'Angebot konnte nicht übermittelt werden.' }, { status: 500 })
  }
}
