import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { getCurrentUser } from '@/lib/current-user'
import { sendTicketReplyEmail } from '@/lib/email'

const schema = z.object({ message: z.string().min(1).max(4000) })

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: ticketId } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })

  const isAdmin = !!process.env.ADMIN_EMAIL && user.email === process.env.ADMIN_EMAIL

  try {
    const { message } = schema.parse(await req.json())
    const db = getDb()

    const ticket = await db.query(
      `SELECT t.id, t.user_id, t.status, t.subject, u.email, u.email_notifications
       FROM support_tickets t JOIN users u ON u.id = t.user_id WHERE t.id = $1`,
      [ticketId]
    )
    if (ticket.rows.length === 0) {
      return NextResponse.json({ error: 'Ticket nicht gefunden.' }, { status: 404 })
    }
    const ticketRow = ticket.rows[0]
    if (!isAdmin && ticketRow.user_id !== user.id) {
      return NextResponse.json({ error: 'Kein Zugriff auf dieses Ticket.' }, { status: 403 })
    }

    await db.query(
      `INSERT INTO support_ticket_messages (ticket_id, sender_id, is_admin, body) VALUES ($1, $2, $3, $4)`,
      [ticketId, user.id, isAdmin, message]
    )
    await db.query(
      `UPDATE support_tickets SET updated_at = now(), status = 'open' WHERE id = $1`,
      [ticketId]
    )

    try {
      if (isAdmin && ticketRow.email_notifications) {
        await sendTicketReplyEmail(ticketRow.email, ticketRow.subject, true, message)
      } else if (!isAdmin && process.env.ADMIN_EMAIL) {
        await sendTicketReplyEmail(process.env.ADMIN_EMAIL, ticketRow.subject, false, message)
      }
    } catch (emailErr) {
      console.error('Benachrichtigung fehlgeschlagen:', emailErr)
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message || 'Ungültige Eingabe.' }, { status: 400 })
    }
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    console.error('Ticket-Antwort Fehler:', message)
    return NextResponse.json({ error: 'Nachricht konnte nicht gesendet werden.' }, { status: 500 })
  }
}
