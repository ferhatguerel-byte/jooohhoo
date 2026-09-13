import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { getCurrentUser } from '@/lib/current-user'
import { sendNewMessageEmail } from '@/lib/email'

const schema = z.object({ message: z.string().min(1).max(2000) })

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: offerId } = await params
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })
  }

  try {
    const { message } = schema.parse(await req.json())
    const db = getDb()

    const offer = await db.query(
      `SELECT o.id, o.subunternehmer_id, j.auftraggeber_id,
              su.email AS subunternehmer_email, su.company_name AS subunternehmer_name,
              ag.email AS auftraggeber_email, ag.company_name AS auftraggeber_name
       FROM offers o
       JOIN jobs j ON j.id = o.job_id
       JOIN users su ON su.id = o.subunternehmer_id
       JOIN users ag ON ag.id = j.auftraggeber_id
       WHERE o.id = $1`,
      [offerId]
    )
    if (offer.rows.length === 0) {
      return NextResponse.json({ error: 'Angebot nicht gefunden.' }, { status: 404 })
    }
    const row = offer.rows[0]
    if (user.id !== row.subunternehmer_id && user.id !== row.auftraggeber_id) {
      return NextResponse.json({ error: 'Kein Zugriff auf dieses Angebot.' }, { status: 403 })
    }

    await db.query('INSERT INTO offer_messages (offer_id, sender_id, body) VALUES ($1, $2, $3)', [
      offerId,
      user.id,
      message,
    ])

    const recipientEmail = user.id === row.subunternehmer_id ? row.auftraggeber_email : row.subunternehmer_email
    const senderName = user.id === row.subunternehmer_id ? row.subunternehmer_name : row.auftraggeber_name
    try {
      await sendNewMessageEmail(recipientEmail, senderName, message)
    } catch (emailErr) {
      console.error('Benachrichtigung fehlgeschlagen:', emailErr)
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message || 'Ungültige Eingabe.' }, { status: 400 })
    }
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    console.error('Nachricht senden Fehler:', message)
    return NextResponse.json({ error: 'Nachricht konnte nicht gesendet werden.' }, { status: 500 })
  }
}
