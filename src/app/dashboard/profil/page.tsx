import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/current-user'

export default async function ProfilPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  return (
    <div>
      <h1 className="text-2xl font-black text-slate-900 mb-6">Mein Profil</h1>
      <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-lg space-y-4">
        <div>
          <p className="text-sm text-slate-400">Firmenname</p>
          <p className="font-semibold text-slate-900">{user.companyName}</p>
        </div>
        <div>
          <p className="text-sm text-slate-400">E-Mail</p>
          <p className="font-semibold text-slate-900">{user.email}</p>
        </div>
        <div>
          <p className="text-sm text-slate-400">Telefon</p>
          <p className="font-semibold text-slate-900">{user.phone || '–'}</p>
        </div>
        <div>
          <p className="text-sm text-slate-400">Adresse</p>
          <p className="font-semibold text-slate-900">{user.plz} {user.ort}</p>
        </div>
        <div>
          <p className="text-sm text-slate-400">Rolle</p>
          <p className="font-semibold text-slate-900">{user.role === 'auftraggeber' ? 'Auftraggeber' : 'Subunternehmer'}</p>
        </div>
        {user.role === 'subunternehmer' && (
          <div>
            <p className="text-sm text-slate-400 mb-1">Gewerke</p>
            <div className="flex flex-wrap gap-2">
              {user.gewerke.map((g) => (
                <span key={g} className="bg-slate-100 text-slate-700 text-sm px-3 py-1 rounded-full">{g}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
