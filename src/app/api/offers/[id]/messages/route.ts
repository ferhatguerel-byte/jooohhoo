import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { getCurrentUser } from '@/lib/current-user'
import { sendNewMessageEmail } from '@/lib/email'
import { handleApiError } from '@/lib/api-error'
import { rateLimit } from '@/lib/security/rate-limit'
import { readJsonBody } from '@/lib/security/request-limits'

const schema = z.object({ message: z.string().min(1).max(2000) })

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: offerId } = await params
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })
  }

  try {
    const { message } = schema.parse(await readJsonBody(req))

    // Phase 4.3 (Teil 2/A): Chat-Nachrichten hatten kein Rate Limit (Audit-Fund) – jede
    // Nachricht löst zusätzlich eine E-Mail an den Empfänger aus (E-Mail-Spam-Risiko), daher ein
    // engeres Zeitfenster als bei selteneren Aktionen wie Auftrags-/Angebots-Erstellung.
    await rateLimit({ key: `offer-messages:${user.id}`, limit: 20, windowSeconds: 300 })

    const db = getDb()

    const offer = await db.query(
      `SELECT o.id, o.subunternehmer_id, j.auftraggeber_id,
              su.email AS subunternehmer_email, su.company_name AS subunternehmer_name, su.email_notifications AS subunternehmer_notify,
              ag.email AS auftraggeber_email, ag.company_name AS auftraggeber_name, ag.email_notifications AS auftraggeber_notify
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
    const recipientNotify = user.id === row.subunternehmer_id ? row.auftraggeber_notify : row.subunternehmer_notify
    const senderName = user.id === row.subunternehmer_id ? row.subunternehmer_name : row.auftraggeber_name
    if (recipientNotify) {
      try {
        await sendNewMessageEmail(recipientEmail, senderName, message)
      } catch (emailErr) {
        console.error('Benachrichtigung fehlgeschlagen:', emailErr)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    return handleApiError(err, 'Nachricht konnte nicht gesendet werden.')
  }
}
