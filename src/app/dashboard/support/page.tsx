import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/current-user'
import { getDb } from '@/lib/db'
import NewTicketForm from './NewTicketForm'

export default async function SupportPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const result = await getDb().query(
    `SELECT id, category, subject, status, updated_at FROM support_tickets
     WHERE user_id = $1 ORDER BY updated_at DESC`,
    [user.id]
  )
  const tickets = result.rows

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <h1 className="text-2xl font-black text-slate-900">Support Center</h1>
        <NewTicketForm />
      </div>

      <div className="space-y-3">
        {tickets.length === 0 && (
          <p className="text-slate-500">Du hast noch keine Support-Anfragen gestellt.</p>
        )}
        {tickets.map((t) => (
          <Link
            key={t.id}
            href={`/dashboard/support/${t.id}`}
            className="block bg-white border border-slate-200 rounded-xl p-4 hover:border-brand/40"
          >
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="text-xs font-semibold text-slate-400 mb-0.5">{t.category}</p>
                <p className="font-bold text-slate-900">{t.subject}</p>
              </div>
              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                  t.status === 'open' ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {t.status === 'open' ? 'Offen' : 'Geschlossen'}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
