import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { getCurrentUser } from '@/lib/current-user'
import { sendOfferAwardedEmail } from '@/lib/email'

const awardSchema = z.object({ offerId: z.string().uuid() })

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: jobId } = await params
  const user = await getCurrentUser()
  if (!user || user.role !== 'auftraggeber') {
    return NextResponse.json({ error: 'Nur Auftraggeber können Aufträge vergeben.' }, { status: 403 })
  }

  try {
    const { offerId } = awardSchema.parse(await req.json())
    const db = getDb()

    const job = await db.query('SELECT id FROM jobs WHERE id = $1 AND auftraggeber_id = $2', [jobId, user.id])
    if (job.rows.length === 0) {
      return NextResponse.json({ error: 'Auftrag nicht gefunden.' }, { status: 404 })
    }

    const offer = await db.query(
      `SELECT o.subunternehmer_id, u.email, u.company_name
       FROM offers o JOIN users u ON u.id = o.subunternehmer_id
       WHERE o.id = $1 AND o.job_id = $2`,
      [offerId, jobId]
    )
    if (offer.rows.length === 0) {
      return NextResponse.json({ error: 'Angebot nicht gefunden.' }, { status: 404 })
    }

    await db.query(
      "UPDATE jobs SET status = 'closed', awarded_subunternehmer_id = $1 WHERE id = $2",
      [offer.rows[0].subunternehmer_id, jobId]
    )
    await db.query("UPDATE offers SET status = 'accepted' WHERE id = $1", [offerId])
    await db.query(
      "UPDATE offers SET status = 'declined' WHERE job_id = $1 AND id != $2 AND status = 'pending'",
      [jobId, offerId]
    )

    try {
      await sendOfferAwardedEmail(offer.rows[0].email, offer.rows[0].company_name)
    } catch (emailErr) {
      console.error('Benachrichtigung fehlgeschlagen:', emailErr)
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message || 'Ungültige Eingabe.' }, { status: 400 })
    }
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    console.error('Auftrag vergeben Fehler:', message)
    return NextResponse.json({ error: 'Auftrag konnte nicht vergeben werden.' }, { status: 500 })
  }
}
