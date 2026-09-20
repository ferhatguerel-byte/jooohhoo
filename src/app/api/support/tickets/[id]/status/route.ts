import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { requireAuthenticatedUserApi, isAdmin, AuthorizationError } from '@/lib/authorization'
import { handleApiError } from '@/lib/api-error'
import { logAdminAction } from '@/lib/admin-audit'

const schema = z.object({ status: z.enum(['open', 'closed']) })

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: ticketId } = await params
  try {
    const user = await requireAuthenticatedUserApi()
    const admin = isAdmin(user)
    const { status } = schema.parse(await req.json())
    const db = getDb()

    const ticket = await db.query('SELECT user_id FROM support_tickets WHERE id = $1', [ticketId])
    if (ticket.rows.length === 0) {
      return NextResponse.json({ error: 'Ticket nicht gefunden.' }, { status: 404 })
    }
    // Nutzer dürfen ihr eigenes Ticket schließen, aber nur der Support kann es wieder öffnen.
    if (!admin && (ticket.rows[0].user_id !== user.id || status !== 'closed')) {
      throw new AuthorizationError('Kein Zugriff.')
    }

    await db.query('UPDATE support_tickets SET status = $1, updated_at = now() WHERE id = $2', [status, ticketId])
    if (admin) {
      await logAdminAction(user.id, 'SUPPORT_TICKET_STATUS_CHANGED', 'support_ticket', ticketId, { status }, req)
    }
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    return handleApiError(err, 'Status konnte nicht geändert werden.')
  }
}
