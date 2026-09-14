import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { getCurrentUser } from '@/lib/current-user'
import { sendNewTicketEmail } from '@/lib/email'

const schema = z.object({
  category: z.string().min(1).max(60),
  subject: z.string().min(1).max(200),
  message: z.string().min(1).max(4000),
})

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })

  const result = await getDb().query(
    `SELECT id, category, subject, status, created_at, updated_at
     FROM support_tickets WHERE user_id = $1 ORDER BY updated_at DESC`,
    [user.id]
  )
  return NextResponse.json({ tickets: result.rows })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })

  try {
    const { category, subject, message } = schema.parse(await req.json())
    const db = getDb()

    const client = await db.connect()
    let ticketId: string
    try {
      await client.query('BEGIN')
      const ticket = await client.query(
        `INSERT INTO support_tickets (user_id, category, subject) VALUES ($1, $2, $3) RETURNING id`,
        [user.id, category, subject]
      )
      ticketId = ticket.rows[0].id
      await client.query(
        `INSERT INTO support_ticket_messages (ticket_id, sender_id, is_admin, body) VALUES ($1, $2, false, $3)`,
        [ticketId, user.id, message]
      )
      await client.query('COMMIT')
    } catch (txErr) {
      await client.query('ROLLBACK')
      throw txErr
    } finally {
      client.release()
    }

    if (process.env.ADMIN_EMAIL) {
      try {
        await sendNewTicketEmail(process.env.ADMIN_EMAIL, user.companyName, category, subject, message)
      } catch (emailErr) {
        console.error('Benachrichtigung fehlgeschlagen:', emailErr)
      }
    }

    return NextResponse.json({ ok: true, ticketId })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message || 'Ungültige Eingabe.' }, { status: 400 })
    }
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    console.error('Ticket erstellen Fehler:', message)
    return NextResponse.json({ error: 'Anfrage konnte nicht gesendet werden.' }, { status: 500 })
  }
}
