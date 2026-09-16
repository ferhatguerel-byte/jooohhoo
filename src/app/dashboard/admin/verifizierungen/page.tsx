import { redirect } from 'next/navigation'
import { Paperclip } from 'lucide-react'
import { getCurrentUser } from '@/lib/current-user'
import { getDb } from '@/lib/db'
import { MEISTERPFLICHTIGE_GEWERKE } from '@/lib/gewerke'
import VerifyActions from './VerifyActions'

export default async function AdminVerifizierungenPage() {
  const user = await getCurrentUser()
  const adminEmail = process.env.ADMIN_EMAIL
  if (!user) redirect('/login')
  if (!adminEmail || user.email !== adminEmail) redirect('/dashboard')

  const result = await getDb().query(
    `SELECT id, company_name, email, plz, ort, gewerke, verification_status, qualification_files, verified_gewerke
     FROM users WHERE role = 'subunternehmer' AND verification_status != 'unverified'
     ORDER BY (verification_status = 'pending') DESC, created_at DESC`
  )
  const users = result.rows

  return (
    <div>
      <h1 className="text-2xl font-black text-slate-900 mb-6">Verifizierungen</h1>
      <div className="space-y-4">
        {users.length === 0 && <p className="text-slate-500">Keine Verifizierungsanfragen.</p>}
        {users.map((u) => (
          <div key={u.id} className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="font-bold text-slate-900">{u.company_name}</div>
                <div className="text-sm text-slate-500">{u.email} · {u.plz} {u.ort}</div>
                <div className="text-sm text-slate-500">{(u.gewerke || []).join(', ')}</div>
                <span className={`inline-block mt-2 text-xs font-bold px-2.5 py-1 rounded-full ${
                  u.verification_status === 'pending' ? 'bg-orange-100 text-orange-700'
                  : u.verification_status === 'verified' ? 'bg-blue-100 text-blue-700'
                  : 'bg-red-100 text-red-700'
                }`}>
                  {u.verification_status === 'pending' ? 'Prüfung läuft' : u.verification_status === 'verified' ? 'Verifiziert' : 'Abgelehnt'}
                </span>
                {u.verified_gewerke && u.verified_gewerke.length > 0 && (
                  <div className="text-xs text-slate-500 mt-1">
                    Freigegebene meisterpflichtige Gewerke: {u.verified_gewerke.join(', ')}
                  </div>
                )}
              </div>
              {u.verification_status === 'pending' && (
                <VerifyActions
                  userId={u.id}
                  meisterpflichtigeGewerke={(u.gewerke || []).filter((g: string) =>
                    (MEISTERPFLICHTIGE_GEWERKE as string[]).includes(g)
                  )}
                />
              )}
            </div>
            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-100">
              {(u.qualification_files || []).map((f: { url: string; name: string; label: string }) => (
                <a
                  key={f.url}
                  href={f.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-brand border border-slate-200 rounded-lg px-3 py-1.5 hover:border-brand/40 flex items-center gap-1"
                >
                  <Paperclip size={12} /> {f.label}: {f.name}
                </a>
              ))}
              {(!u.qualification_files || u.qualification_files.length === 0) && (
                <span className="text-xs text-slate-400">Keine Dateien hochgeladen</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
