import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getCurrentUser } from '@/lib/current-user'
import { isAdmin as checkIsAdmin } from '@/lib/authorization'
import { getDb } from '@/lib/db'
import TicketThread, { TicketMessage } from '@/components/TicketThread'

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const isAdmin = checkIsAdmin(user)

  const db = getDb()
  const ticketResult = await db.query(
    `SELECT id, user_id, category, subject, status FROM support_tickets WHERE id = $1`,
    [id]
  )
  if (ticketResult.rows.length === 0) notFound()
  const ticket = ticketResult.rows[0]
  if (!isAdmin && ticket.user_id !== user.id) redirect('/dashboard/support')

  const messagesResult = await db.query(
    `SELECT m.id, m.is_admin, m.body, m.created_at, u.company_name AS sender_name
     FROM support_ticket_messages m JOIN users u ON u.id = m.sender_id
     WHERE m.ticket_id = $1 ORDER BY m.created_at ASC`,
    [id]
  )
  const messages: TicketMessage[] = messagesResult.rows.map((r) => ({
    id: r.id,
    senderName: r.is_admin ? 'BAUVERSUS' : r.sender_name,
    isAdmin: r.is_admin,
    body: r.body,
    createdAt: r.created_at,
  }))

  const backHref = isAdmin && ticket.user_id !== user.id ? '/dashboard/admin/support' : '/dashboard/support'

  return (
    <div>
      <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-brand mb-4">
        <ArrowLeft size={14} /> Zurück
      </Link>
      <p className="text-xs font-semibold text-slate-400 mb-0.5">{ticket.category}</p>
      <h1 className="text-2xl font-black text-slate-900 mb-6">{ticket.subject}</h1>
      <TicketThread ticketId={ticket.id} messages={messages} status={ticket.status} isAdmin={isAdmin} />
    </div>
  )
}
