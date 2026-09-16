import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { getCurrentUser } from '@/lib/current-user'

const schema = z.object({ status: z.enum(['open', 'closed']) })

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: ticketId } = await params
  const user = await getCurrentUser()
  const isAdmin = !!process.env.ADMIN_EMAIL && !!user && user.email === process.env.ADMIN_EMAIL
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })

  try {
    const { status } = schema.parse(await req.json())
    const db = getDb()

    const ticket = await db.query('SELECT user_id FROM support_tickets WHERE id = $1', [ticketId])
    if (ticket.rows.length === 0) {
      return NextResponse.json({ error: 'Ticket nicht gefunden.' }, { status: 404 })
    }
    // Nutzer dürfen ihr eigenes Ticket schließen, aber nur der Support kann es wieder öffnen.
    if (!isAdmin && (ticket.rows[0].user_id !== user.id || status !== 'closed')) {
      return NextResponse.json({ error: 'Kein Zugriff.' }, { status: 403 })
    }

    await db.query('UPDATE support_tickets SET status = $1, updated_at = now() WHERE id = $2', [status, ticketId])
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message || 'Ungültige Eingabe.' }, { status: 400 })
    }
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    console.error('Ticket-Status Fehler:', message)
    return NextResponse.json({ error: 'Status konnte nicht geändert werden.' }, { status: 500 })
  }
}
