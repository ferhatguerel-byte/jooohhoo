import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/current-user'
import { getDb } from '@/lib/db'
import { estimatePlzDistanceKm } from '@/lib/plz-geo'
import JobFilters from './JobFilters'
import OfferForm from './OfferForm'
import OfferChat, { ChatMessage } from '@/components/OfferChat'
import HideJobButton from './HideJobButton'
import { isMeisterpflichtig } from '@/lib/gewerke'
import { Lock } from 'lucide-react'

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ gewerke?: string; plz?: string; radius?: string; ausgeblendet?: string }>
}) {
  const { gewerke: gewerkeParam, plz, radius, ausgeblendet } = await searchParams
  const showHidden = ausgeblendet === '1'
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (user.role !== 'subunternehmer') redirect('/dashboard')

  const hasActiveSub = user.subscriptionStatus === 'active' && user.subscriptionTier
  if (!hasActiveSub) {
    return (
      <div>
        <h1 className="text-2xl font-black text-[#17202a] mb-6">Offene Aufträge</h1>
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-6">
          <p className="text-slate-700 mb-4">
            Sie benötigen ein aktives Abo, um Aufträge zu sehen und Auftraggeber zu kontaktieren.
          </p>
          <a href="/dashboard/abo" className="bg-brand hover:bg-brand-hover text-white font-bold py-2.5 px-6 rounded-lg inline-block">
            Abo auswählen
          </a>
        </div>
      </div>
    )
  }

  const selectedGewerke = gewerkeParam ? gewerkeParam.split(',').filter(Boolean) : []

  const db = getDb()
  const params: unknown[] = [user.id]
  let filterClause = ''
  if (selectedGewerke.length > 0) {
    params.push(selectedGewerke)
    filterClause = 'AND j.gewerk = ANY($2)'
  }

  const jobsResult = await db.query(
    `SELECT j.*, o.id AS my_offer_id, o.price AS my_offer_price, o.message AS my_offer_message,
            o.pricing_type AS my_offer_pricing_type, o.viewed_at AS my_offer_viewed_at,
            h.job_id IS NOT NULL AS is_hidden
     FROM jobs j
     LEFT JOIN offers o ON o.job_id = j.id AND o.subunternehmer_id = $1
     LEFT JOIN hidden_jobs h ON h.job_id = j.id AND h.user_id = $1
     WHERE j.status = 'open' ${filterClause} ${showHidden ? 'AND h.job_id IS NOT NULL' : 'AND h.job_id IS NULL'}
     ORDER BY j.created_at DESC`,
    params
  )

  const hiddenCountResult = await db.query(
    `SELECT COUNT(*)::int AS count FROM hidden_jobs h JOIN jobs j ON j.id = h.job_id
     WHERE h.user_id = $1 AND j.status = 'open'`,
    [user.id]
  )
  const hiddenCount = hiddenCountResult.rows[0].count

  let jobs = jobsResult.rows.map((job) => ({
    ...job,
    distanceKm: plz ? estimatePlzDistanceKm(plz, job.plz) : null,
  }))

  if (plz && radius) {
    const radiusNum = Number(radius)
    jobs = jobs.filter((job) => job.distanceKm !== null && job.distanceKm <= radiusNum)
    jobs.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity))
  }

  const jobIds = jobs.map((j) => j.id)
  const lineItemsResult = jobIds.length
    ? await db.query(
        `SELECT id, job_id, title, gewerk FROM job_line_items WHERE job_id = ANY($1) ORDER BY position_order`,
        [jobIds]
      )
    : { rows: [] as { id: string; job_id: string; title: string; gewerk: string }[] }

  const lineItemsByJob = new Map<string, { id: string; title: string; gewerk: string }[]>()
  for (const li of lineItemsResult.rows) {
    if (!lineItemsByJob.has(li.job_id)) lineItemsByJob.set(li.job_id, [])
    lineItemsByJob.get(li.job_id)!.push({ id: li.id, title: li.title, gewerk: li.gewerk })
  }

  const myOfferIds = jobs.map((j) => j.my_offer_id).filter(Boolean)
  const myOfferLineItemsResult = myOfferIds.length
    ? await db.query(
        `SELECT offer_id, job_line_item_id, price FROM offer_line_items WHERE offer_id = ANY($1)`,
        [myOfferIds]
      )
    : { rows: [] as { offer_id: string; job_line_item_id: string; price: number }[] }

  const myOfferPricesByOffer = new Map<string, Record<string, number>>()
  for (const row of myOfferLineItemsResult.rows) {
    if (!myOfferPricesByOffer.has(row.offer_id)) myOfferPricesByOffer.set(row.offer_id, {})
    myOfferPricesByOffer.get(row.offer_id)![row.job_line_item_id] = row.price
  }

  const myMessagesResult = myOfferIds.length
    ? await db.query(
        `SELECT m.id, m.offer_id, m.sender_id, m.body, m.created_at, u.company_name AS sender_name
         FROM offer_messages m JOIN users u ON u.id = m.sender_id
         WHERE m.offer_id = ANY($1) ORDER BY m.created_at ASC`,
        [myOfferIds]
      )
    : { rows: [] as { offer_id: string; id: string; sender_id: string; body: string; created_at: string; sender_name: string }[] }

  const myMessagesByOffer = new Map<string, ChatMessage[]>()
  for (const row of myMessagesResult.rows) {
    if (!myMessagesByOffer.has(row.offer_id)) myMessagesByOffer.set(row.offer_id, [])
    myMessagesByOffer.get(row.offer_id)!.push({
      id: row.id,
      senderId: row.sender_id,
      senderName: row.sender_name,
      body: row.body,
      createdAt: row.created_at,
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
        <h1 className="text-2xl font-black text-[#17202a]">
          {showHidden ? 'Ausgeblendete Aufträge' : 'Offene Aufträge'}
        </h1>
        {(showHidden || hiddenCount > 0) && (
          <Link
            href={showHidden ? '/dashboard/jobs' : '/dashboard/jobs?ausgeblendet=1'}
            className="text-sm font-semibold text-brand hover:underline"
          >
            {showHidden ? '← Zurück zu offenen Aufträgen' : `Ausgeblendete Aufträge (${hiddenCount})`}
          </Link>
        )}
      </div>

      {!showHidden && <JobFilters initialGewerke={selectedGewerke} initialPlz={plz || user.plz || ''} initialRadius={radius || ''} />}

      <div className="space-y-4">
        {jobs.length === 0 && (
          <p className="text-slate-500">
            {showHidden ? 'Keine ausgeblendeten Aufträge.' : 'Aktuell keine passenden Aufträge.'}
          </p>
        )}
        {jobs.map((job) => {
          const lineItems = lineItemsByJob.get(job.id) || []
          return (
            <div key={job.id} className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-start justify-between gap-4 mb-2">
                <h3 className="font-bold text-[#17202a]">{job.title}</h3>
                <div className="flex items-center gap-3 shrink-0">
                  {(job.budget_min || job.budget_max) && (
                    <span className="text-sm font-bold text-[#17202a] whitespace-nowrap">
                      €{job.budget_min || '?'}{job.budget_max ? ` – €${job.budget_max}` : ''}
                    </span>
                  )}
                  {!job.my_offer_id && <HideJobButton jobId={job.id} hidden={showHidden} />}
                </div>
              </div>
              <p className="text-sm text-slate-500 mb-3">
                {job.gewerk} · {job.plz} {job.ort}
                {job.distanceKm !== null && <span className="text-slate-400"> · ca. {job.distanceKm} km entfernt</span>}
              </p>
              <p className="text-sm text-slate-600 mb-4">{job.description}</p>

              {(job.estimated_cost_min || job.estimated_cost_max) && (
                <p className="text-sm text-slate-500 mb-4">
                  Geschätzte Kosten (Kundenangabe): {job.estimated_cost_min ? `€${Number(job.estimated_cost_min).toLocaleString('de-DE')}` : '?'}
                  {job.estimated_cost_max ? ` – €${Number(job.estimated_cost_max).toLocaleString('de-DE')}` : ''}
                </p>
              )}

              {job.attachments && job.attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {job.attachments.map((f: { url: string; name: string }) => (
                    <a
                      key={f.url}
                      href={f.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-brand border border-slate-200 rounded-lg px-3 py-1.5 hover:border-brand/40"
                    >
                      📎 {f.name}
                    </a>
                  ))}
                </div>
              )}

              {lineItems.length > 0 && (
                <div className="bg-slate-50 rounded-lg p-3 mb-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Leistungsverzeichnis</p>
                  <ul className="space-y-1">
                    {lineItems.map((li) => (
                      <li key={li.id} className="text-sm text-slate-700 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" /> {li.title}
                        <span className="text-slate-400 text-xs">({li.gewerk})</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {user.blockedGewerke.includes(job.gewerk) && !job.my_offer_id ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-2 text-sm text-red-700">
                  <Lock size={16} className="shrink-0 mt-0.5" />
                  <span>
                    Das Gewerk {job.gewerk} wurde für Ihr Konto gesperrt. Bitte kontaktieren Sie den{' '}
                    <Link href="/dashboard/support" className="font-semibold underline">Support</Link>.
                  </span>
                </div>
              ) : isMeisterpflichtig(job.gewerk) && user.verificationStatus !== 'verified' && !job.my_offer_id ? (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex items-start gap-2 text-sm text-slate-600">
                  <Lock size={16} className="shrink-0 mt-0.5 text-slate-400" />
                  <span>
                    {job.gewerk} ist ein meisterpflichtiges Gewerk. Um hier Angebote abzugeben, laden Sie bitte Ihren
                    Meisterbrief/Qualifikationsnachweis in{' '}
                    <Link href="/dashboard/profil" className="font-semibold text-brand hover:underline">Ihrem Profil</Link>{' '}
                    hoch und warten Sie die Verifizierung ab.
                  </span>
                </div>
              ) : (
                <OfferForm
                  jobId={job.id}
                  lineItems={lineItems}
                  existingOffer={
                    job.my_offer_price
                      ? {
                          price: job.my_offer_price,
                          message: job.my_offer_message,
                          pricingType: job.my_offer_pricing_type,
                          viewedByAuftraggeber: job.my_offer_viewed_at !== null,
                          lineItemPrices: myOfferPricesByOffer.get(job.my_offer_id) || {},
                        }
                      : undefined
                  }
                />
              )}

              {job.my_offer_id && (
                <OfferChat
                  offerId={job.my_offer_id}
                  messages={myMessagesByOffer.get(job.my_offer_id) || []}
                  currentUserId={user.id}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
