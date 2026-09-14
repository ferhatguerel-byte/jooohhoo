import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { getCurrentUser } from '@/lib/current-user'

const schema = z.object({ message: z.string().min(1).max(4000) })

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: ticketId } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })

  const isAdmin = !!process.env.ADMIN_EMAIL && user.email === process.env.ADMIN_EMAIL

  try {
    const { message } = schema.parse(await req.json())
    const db = getDb()

    const ticket = await db.query('SELECT id, user_id, status FROM support_tickets WHERE id = $1', [ticketId])
    if (ticket.rows.length === 0) {
      return NextResponse.json({ error: 'Ticket nicht gefunden.' }, { status: 404 })
    }
    if (!isAdmin && ticket.rows[0].user_id !== user.id) {
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
