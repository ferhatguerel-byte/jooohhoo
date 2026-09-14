import { redirect } from 'next/navigation'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { getCurrentUser } from '@/lib/current-user'
import { getDb } from '@/lib/db'
import { TIERS, type TierId } from '@/lib/tiers'
import NutzerSearch from './NutzerSearch'

export default async function AdminNutzerPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const user = await getCurrentUser()
  const adminEmail = process.env.ADMIN_EMAIL
  if (!user) redirect('/login')
  if (!adminEmail || user.email !== adminEmail) redirect('/dashboard')

  const db = getDb()
  const search = (q || '').trim()

  const result = await db.query(
    `SELECT id, company_name, email, plz, ort, gewerke, subscription_tier, subscription_status,
            verification_status, account_status, blocked_gewerke,
            (SELECT COUNT(*)::int FROM admin_warnings w WHERE w.user_id = users.id) AS warning_count
     FROM users
     WHERE role = 'subunternehmer'
       AND ($1 = '' OR company_name ILIKE '%' || $1 || '%' OR email ILIKE '%' || $1 || '%')
     ORDER BY (account_status = 'suspended') DESC, created_at DESC`,
    [search]
  )
  const users = result.rows

  const verificationLabels: Record<string, { text: string; className: string }> = {
    unverified: { text: 'Nicht verifiziert', className: 'bg-slate-100 text-slate-500' },
    pending: { text: 'Prüfung läuft', className: 'bg-orange-100 text-orange-700' },
    verified: { text: 'Verifiziert', className: 'bg-blue-100 text-blue-700' },
    rejected: { text: 'Abgelehnt', className: 'bg-red-100 text-red-700' },
  }

  return (
    <div>
      <h1 className="text-2xl font-black text-slate-900 mb-6">Nutzerverwaltung</h1>

      <NutzerSearch initialQuery={search} />

      <div className="space-y-3 mt-6">
        {users.length === 0 && <p className="text-slate-500">Keine Unternehmer gefunden.</p>}
        {users.map((u) => {
          const tier = u.subscription_tier ? TIERS[u.subscription_tier as TierId] : undefined
          const verification = verificationLabels[u.verification_status] || verificationLabels.unverified
          return (
            <Link
              key={u.id}
              href={`/dashboard/admin/nutzer/${u.id}`}
              className={`block bg-white border rounded-xl p-4 hover:border-brand/40 transition ${
                u.account_status === 'suspended' ? 'border-red-300 bg-red-50/30' : 'border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{u.company_name}</span>
                    {u.account_status === 'suspended' && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 flex items-center gap-1">
                        <AlertTriangle size={11} /> Gesperrt
                      </span>
                    )}
                    {u.warning_count > 0 && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                        {u.warning_count} Mahnung{u.warning_count === 1 ? '' : 'en'}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-slate-500">{u.email} · {u.plz} {u.ort}</div>
                  <div className="text-sm text-slate-500">{(u.gewerke || []).join(', ') || '–'}</div>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${verification.className}`}>{verification.text}</span>
                  <span className="text-xs font-semibold text-slate-500 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-full">
                    {tier ? tier.name : 'Kein Abo'}
                  </span>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
