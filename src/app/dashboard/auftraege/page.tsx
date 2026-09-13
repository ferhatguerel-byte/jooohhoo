import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/current-user'
import { getDb } from '@/lib/db'
import NewJobForm from './NewJobForm'

export default async function AuftraegePage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (user.role !== 'auftraggeber') redirect('/dashboard')

  const db = getDb()
  const jobsResult = await db.query(
    `SELECT j.*, COUNT(o.id)::int AS offer_count
     FROM jobs j
     LEFT JOIN offers o ON o.job_id = j.id
     WHERE j.auftraggeber_id = $1
     GROUP BY j.id
     ORDER BY j.created_at DESC`,
    [user.id]
  )
  const jobs = jobsResult.rows

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-black text-slate-900">Meine Aufträge</h1>
      </div>

      <NewJobForm />

      <div className="space-y-4">
        {jobs.length === 0 && <p className="text-slate-500">Noch keine Aufträge eingestellt.</p>}
        {jobs.map((job) => (
          <Link
            key={job.id}
            href={`/dashboard/auftraege/${job.id}`}
            className="block bg-white border border-slate-200 rounded-xl p-5 hover:border-brand/40 hover:shadow-sm transition"
          >
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-slate-900">{job.title}</h3>
              <span className={`text-xs font-bold px-2 py-1 rounded-full ${job.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                {job.status === 'open' ? 'Offen' : 'Geschlossen'}
              </span>
            </div>
            <p className="text-sm text-slate-500 mb-2">{job.gewerk} · {job.plz} {job.ort}</p>
            <p className="text-sm text-slate-600">{job.offer_count} Angebot{job.offer_count === 1 ? '' : 'e'} erhalten</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
