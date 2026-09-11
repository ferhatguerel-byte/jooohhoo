import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/current-user'
import { getDb } from '@/lib/db'
import { TIERS } from '@/lib/tiers'
import NewJobForm from './NewJobForm'

export default async function AuftraegePage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (user.role !== 'auftraggeber') redirect('/dashboard')

  const hasActiveSub = user.subscriptionStatus === 'active' && user.subscriptionTier

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
  const activeJobCount = jobs.filter((j) => j.status === 'open').length
  const limit = hasActiveSub ? TIERS[user.subscriptionTier!].maxActiveJobs : 0

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-black text-slate-900">Meine Aufträge</h1>
        {hasActiveSub && (
          <span className="text-sm text-slate-500">{activeJobCount} / {limit} aktive Aufträge</span>
        )}
      </div>

      {!hasActiveSub ? (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-6 mb-8">
          <p className="text-slate-700 mb-4">
            Sie benötigen ein aktives Abo, um Aufträge einzustellen und Subunternehmer-Kontakte freizuschalten.
          </p>
          <Link href="/dashboard/abo" className="bg-blue-900 hover:bg-blue-800 text-white font-bold py-2.5 px-6 rounded-lg inline-block">
            Abo auswählen
          </Link>
        </div>
      ) : (
        <NewJobForm disabled={activeJobCount >= limit} />
      )}

      <div className="space-y-4">
        {jobs.length === 0 && <p className="text-slate-500">Noch keine Aufträge eingestellt.</p>}
        {jobs.map((job) => (
          <Link
            key={job.id}
            href={`/dashboard/auftraege/${job.id}`}
            className="block bg-white border border-slate-200 rounded-xl p-5 hover:border-blue-900/40 hover:shadow-sm transition"
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
