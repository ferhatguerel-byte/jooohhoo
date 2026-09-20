import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { requireAuthenticatedUserApi, isAdmin, AuthorizationError } from '@/lib/authorization'
import { handleApiError } from '@/lib/api-error'
import { sendTicketReplyEmail } from '@/lib/email'

const schema = z.object({ message: z.string().min(1).max(4000) })

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: ticketId } = await params
  try {
    const user = await requireAuthenticatedUserApi()
    const admin = isAdmin(user)
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
    if (!admin && ticketRow.user_id !== user.id) {
      throw new AuthorizationError('Kein Zugriff auf dieses Ticket.')
    }

    await db.query(
      `INSERT INTO support_ticket_messages (ticket_id, sender_id, is_admin, body) VALUES ($1, $2, $3, $4)`,
      [ticketId, user.id, admin, message]
    )
    await db.query(
      `UPDATE support_tickets SET updated_at = now(), status = 'open' WHERE id = $1`,
      [ticketId]
    )

    try {
      if (admin && ticketRow.email_notifications) {
        await sendTicketReplyEmail(ticketRow.email, ticketRow.subject, true, message)
      } else if (!admin && process.env.ADMIN_EMAIL) {
        await sendTicketReplyEmail(process.env.ADMIN_EMAIL, ticketRow.subject, false, message)
      }
    } catch (emailErr) {
      console.error('Benachrichtigung fehlgeschlagen:', emailErr)
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    return handleApiError(err, 'Nachricht konnte nicht gesendet werden.')
  }
}
