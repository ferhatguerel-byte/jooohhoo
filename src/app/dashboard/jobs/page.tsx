import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/current-user'
import { getDb } from '@/lib/db'
import { GEWERKE } from '@/lib/gewerke'
import OfferForm from './OfferForm'

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ gewerk?: string }>
}) {
  const { gewerk } = await searchParams
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (user.role !== 'subunternehmer') redirect('/dashboard')

  const db = getDb()
  const params: unknown[] = [user.id]
  let filterClause = ''
  if (gewerk) {
    params.push(gewerk)
    filterClause = 'AND j.gewerk = $2'
  }

  const jobsResult = await db.query(
    `SELECT j.*, o.price AS my_offer_price, o.message AS my_offer_message
     FROM jobs j
     LEFT JOIN offers o ON o.job_id = j.id AND o.subunternehmer_id = $1
     WHERE j.status = 'open' ${filterClause}
     ORDER BY j.created_at DESC`,
    params
  )

  return (
    <div>
      <h1 className="text-2xl font-black text-slate-900 mb-6">Offene Aufträge</h1>

      <div className="flex flex-wrap gap-2 mb-8">
        <Link
          href="/dashboard/jobs"
          className={`px-3 py-1.5 rounded-full text-sm border ${!gewerk ? 'bg-blue-900 border-blue-900 text-white' : 'border-slate-300 text-slate-600'}`}
        >
          Alle
        </Link>
        {GEWERKE.map((g) => (
          <Link
            key={g}
            href={`/dashboard/jobs?gewerk=${encodeURIComponent(g)}`}
            className={`px-3 py-1.5 rounded-full text-sm border ${gewerk === g ? 'bg-blue-900 border-blue-900 text-white' : 'border-slate-300 text-slate-600'}`}
          >
            {g}
          </Link>
        ))}
      </div>

      <div className="space-y-4">
        {jobsResult.rows.length === 0 && <p className="text-slate-500">Aktuell keine passenden Aufträge.</p>}
        {jobsResult.rows.map((job) => (
          <div key={job.id} className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-start justify-between gap-4 mb-2">
              <h3 className="font-bold text-slate-900">{job.title}</h3>
              {(job.budget_min || job.budget_max) && (
                <span className="text-sm font-bold text-blue-900 whitespace-nowrap">
                  €{job.budget_min || '?'}{job.budget_max ? ` – €${job.budget_max}` : ''}
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500 mb-3">{job.gewerk} · {job.plz} {job.ort}</p>
            <p className="text-sm text-slate-600 mb-4">{job.description}</p>
            <OfferForm
              jobId={job.id}
              existingOffer={job.my_offer_price ? { price: job.my_offer_price, message: job.my_offer_message } : undefined}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
