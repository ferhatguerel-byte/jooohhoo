import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/current-user'
import { getDb } from '@/lib/db'
import UnlockButton from './UnlockButton'

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (user.role !== 'auftraggeber') redirect('/dashboard')

  const db = getDb()
  const jobResult = await db.query('SELECT * FROM jobs WHERE id = $1 AND auftraggeber_id = $2', [id, user.id])
  const job = jobResult.rows[0]
  if (!job) notFound()

  const offersResult = await db.query(
    `SELECT o.id, o.price, o.message, o.created_at,
            u.company_name, u.email, u.phone, u.plz, u.ort,
            (lu.id IS NOT NULL) AS unlocked
     FROM offers o
     JOIN users u ON u.id = o.subunternehmer_id
     LEFT JOIN lead_unlocks lu ON lu.offer_id = o.id AND lu.auftraggeber_id = $1
     WHERE o.job_id = $2
     ORDER BY o.created_at ASC`,
    [user.id, id]
  )

  return (
    <div>
      <Link href="/dashboard/auftraege" className="text-sm text-blue-900 hover:underline">← Zurück zu meinen Aufträgen</Link>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 my-6">
        <h1 className="text-2xl font-black text-slate-900 mb-2">{job.title}</h1>
        <p className="text-slate-500 mb-4">{job.gewerk} · {job.plz} {job.ort}</p>
        <p className="text-slate-700 whitespace-pre-wrap mb-4">{job.description}</p>
        <div className="flex gap-6 text-sm text-slate-500">
          {job.budget_min && <span>Budget: €{job.budget_min}{job.budget_max ? ` – €${job.budget_max}` : ''}</span>}
          {job.deadline && <span>Frist: {new Date(job.deadline).toLocaleDateString('de-DE')}</span>}
        </div>
      </div>

      <h2 className="text-xl font-black text-slate-900 mb-4">
        {offersResult.rows.length} Angebot{offersResult.rows.length === 1 ? '' : 'e'}
      </h2>

      <div className="space-y-4">
        {offersResult.rows.length === 0 && <p className="text-slate-500">Noch keine Angebote erhalten.</p>}
        {offersResult.rows.map((offer) => (
          <div key={offer.id} className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-bold text-slate-900">
                  {offer.unlocked ? offer.company_name : 'Subunternehmer'}
                </div>
                <div className="text-sm text-slate-500">{offer.plz} {offer.ort}</div>
              </div>
              <div className="text-xl font-black text-blue-900">€{offer.price}</div>
            </div>
            {offer.message && <p className="text-sm text-slate-600 mt-3">{offer.message}</p>}

            {offer.unlocked ? (
              <div className="mt-4 pt-4 border-t border-slate-100 text-sm text-slate-700 space-y-1">
                <div>📧 {offer.email}</div>
                {offer.phone && <div>📞 {offer.phone}</div>}
              </div>
            ) : (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <UnlockButton offerId={offer.id} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
