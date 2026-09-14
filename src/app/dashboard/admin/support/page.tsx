import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/current-user'
import { getDb } from '@/lib/db'

export default async function AdminSupportPage() {
  const user = await getCurrentUser()
  const adminEmail = process.env.ADMIN_EMAIL
  if (!user) redirect('/login')
  if (!adminEmail || user.email !== adminEmail) redirect('/dashboard')

  const result = await getDb().query(
    `SELECT t.id, t.category, t.subject, t.status, t.updated_at, u.company_name, u.email
     FROM support_tickets t JOIN users u ON u.id = t.user_id
     ORDER BY (t.status = 'open') DESC, t.updated_at DESC`
  )
  const tickets = result.rows

  return (
    <div>
      <h1 className="text-2xl font-black text-slate-900 mb-6">Support-Verwaltung</h1>
      <div className="space-y-3">
        {tickets.length === 0 && <p className="text-slate-500">Keine Support-Anfragen.</p>}
        {tickets.map((t) => (
          <Link
            key={t.id}
            href={`/dashboard/support/${t.id}`}
            className="block bg-white border border-slate-200 rounded-xl p-4 hover:border-brand/40"
          >
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="text-xs font-semibold text-slate-400 mb-0.5">{t.category} · {t.company_name} ({t.email})</p>
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
