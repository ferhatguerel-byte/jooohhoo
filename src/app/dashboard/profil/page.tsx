import { redirect } from 'next/navigation'
import { Star } from 'lucide-react'
import { getCurrentUser } from '@/lib/current-user'
import { getDb } from '@/lib/db'
import ProfileForm from './ProfileForm'

export default async function ProfilPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  let rating: { avg: number; count: number } | null = null
  if (user.role === 'subunternehmer') {
    const result = await getDb().query(
      `SELECT AVG(rating)::numeric(2,1) AS avg, COUNT(*)::int AS count FROM reviews WHERE reviewee_id = $1`,
      [user.id]
    )
    if (result.rows[0]?.count > 0) {
      rating = { avg: Number(result.rows[0].avg), count: result.rows[0].count }
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-black text-slate-900 mb-6">Mein Profil</h1>

      {rating && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6 flex items-center gap-2 max-w-lg">
          <Star size={20} className="fill-orange-400 text-orange-400" />
          <span className="font-bold text-slate-900">{rating.avg} / 5</span>
          <span className="text-sm text-slate-500">({rating.count} Bewertung{rating.count === 1 ? '' : 'en'} von Auftraggebern)</span>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-lg">
        <p className="text-sm text-slate-400 mb-4">
          E-Mail: <span className="text-slate-700 font-semibold">{user.email}</span> ·{' '}
          Rolle: <span className="text-slate-700 font-semibold">{user.role === 'auftraggeber' ? 'Auftraggeber' : 'Subunternehmer'}</span>
        </p>
        <ProfileForm
          role={user.role}
          companyName={user.companyName}
          phone={user.phone}
          plz={user.plz}
          ort={user.ort}
          gewerke={user.gewerke}
        />
      </div>
    </div>
  )
}
