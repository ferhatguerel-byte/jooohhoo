import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { Star, ShieldCheck, Ruler, BadgeCheck, Paperclip, TrendingUp, Zap } from 'lucide-react'
import { getCurrentUser } from '@/lib/current-user'
import { getDb } from '@/lib/db'
import { getRegionalPriceStats } from '@/lib/regional-price'
import { getResponseTimeStatsBatch } from '@/lib/response-time'
import AwardButton from './AwardButton'
import ReviewForm from './ReviewForm'
import EditJobButton from './EditJobButton'
import OfferChat, { ChatMessage } from '@/components/OfferChat'

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (user.role !== 'auftraggeber') redirect('/dashboard')

  const db = getDb()
  const jobResult = await db.query('SELECT * FROM jobs WHERE id = $1 AND auftraggeber_id = $2', [id, user.id])
  const job = jobResult.rows[0]
  if (!job) notFound()

  const lineItemsResult = await db.query(
    'SELECT id, title, gewerk, description FROM job_line_items WHERE job_id = $1 ORDER BY position_order',
    [id]
  )
  const lineItems = lineItemsResult.rows

  // Ab jetzt gilt der Auftraggeber als informiert – der Unternehmer kann sein
  // Angebot danach nicht mehr korrigieren.
  await db.query("UPDATE offers SET viewed_at = now() WHERE job_id = $1 AND viewed_at IS NULL", [id])

  const offersResult = await db.query(
    `SELECT o.id, o.price, o.message, o.status, o.pricing_type, o.created_at,
            u.id AS subunternehmer_id, u.company_name, u.email, u.phone, u.plz, u.ort,
            u.verification_status,
            COALESCE(r.avg_rating, 0) AS avg_rating,
            COALESCE(r.review_count, 0) AS review_count
     FROM offers o
     JOIN users u ON u.id = o.subunternehmer_id
     LEFT JOIN (
       SELECT reviewee_id, AVG(rating)::numeric(2,1) AS avg_rating, COUNT(*)::int AS review_count
       FROM reviews GROUP BY reviewee_id
     ) r ON r.reviewee_id = u.id
     WHERE o.job_id = $1
     ORDER BY o.price ASC`,
    [id]
  )
  const offers = offersResult.rows

  const offerIds = offers.map((o) => o.id)
  const offerLineItemsResult = offerIds.length
    ? await db.query('SELECT offer_id, job_line_item_id, price FROM offer_line_items WHERE offer_id = ANY($1)', [offerIds])
    : { rows: [] as { offer_id: string; job_line_item_id: string; price: number }[] }

  const priceMap = new Map<string, Map<string, number>>()
  for (const row of offerLineItemsResult.rows) {
    if (!priceMap.has(row.offer_id)) priceMap.set(row.offer_id, new Map())
    priceMap.get(row.offer_id)!.set(row.job_line_item_id, row.price)
  }

  const messagesResult = offerIds.length
    ? await db.query(
        `SELECT m.id, m.offer_id, m.sender_id, m.body, m.created_at, u.company_name AS sender_name
         FROM offer_messages m JOIN users u ON u.id = m.sender_id
         WHERE m.offer_id = ANY($1) ORDER BY m.created_at ASC`,
        [offerIds]
      )
    : { rows: [] as { offer_id: string; id: string; sender_id: string; body: string; created_at: string; sender_name: string }[] }

  const messagesByOffer = new Map<string, ChatMessage[]>()
  for (const row of messagesResult.rows) {
    if (!messagesByOffer.has(row.offer_id)) messagesByOffer.set(row.offer_id, [])
    messagesByOffer.get(row.offer_id)!.push({
      id: row.id,
      senderId: row.sender_id,
      senderName: row.sender_name,
      body: row.body,
      createdAt: row.created_at,
    })
  }

  const regionalPrice = await getRegionalPriceStats(job.gewerk, job.plz)

  const responseTimeStatsByUser = await getResponseTimeStatsBatch(offers.map((o) => o.subunternehmer_id))
  const responseTimeByOffer = new Map<string, string>()
  for (const offer of offers) {
    const stats = responseTimeStatsByUser.get(offer.subunternehmer_id)
    if (stats) responseTimeByOffer.set(offer.id, stats.label)
  }

  let existingReview = null
  if (job.awarded_subunternehmer_id) {
    const reviewResult = await db.query(
      'SELECT rating, comment FROM reviews WHERE job_id = $1 AND reviewer_id = $2 AND reviewee_id = $3',
      [id, user.id, job.awarded_subunternehmer_id]
    )
    existingReview = reviewResult.rows[0] || null
  }

  return (
    <div>
      <Link href="/dashboard/auftraege" className="text-sm text-[#17202a] font-semibold hover:underline">← Zurück zu meinen Aufträgen</Link>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 my-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-black text-[#17202a]">{job.title}</h1>
          <span className={`text-xs font-bold px-2 py-1 rounded-full ${job.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
            {job.awarded_subunternehmer_id ? 'Vergeben' : job.status === 'open' ? 'Offen' : 'Geschlossen'}
          </span>
        </div>
        <p className="text-slate-500 mb-4">{job.gewerk} · {job.plz} {job.ort}</p>
        <p className="text-slate-700 whitespace-pre-wrap mb-4">{job.description}</p>
        <div className="flex gap-6 text-sm text-slate-500 mb-4">
          {job.budget_min && <span>Budget: €{job.budget_min}{job.budget_max ? ` – €${job.budget_max}` : ''}</span>}
          {job.deadline && <span>Frist: {new Date(job.deadline).toLocaleDateString('de-DE')}</span>}
          {(job.estimated_cost_min || job.estimated_cost_max) && (
            <span>
              KI-Schätzung: €{Number(job.estimated_cost_min || 0).toLocaleString('de-DE')}
              {job.estimated_cost_max ? ` – €${Number(job.estimated_cost_max).toLocaleString('de-DE')}` : ''}
            </span>
          )}
        </div>
        {job.attachments && job.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {job.attachments.map((f: { fileId: string; name: string }) => (
              <a
                key={f.fileId}
                href={`/api/files/${f.fileId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-brand border border-slate-200 rounded-lg px-3 py-1.5 hover:border-brand/40 flex items-center gap-1"
              >
                <Paperclip size={12} /> {f.name}
              </a>
            ))}
          </div>
        )}
        {!job.awarded_subunternehmer_id && (
          <EditJobButton
            jobId={id}
            initialTitle={job.title}
            initialDescription={job.description}
            initialDeadline={job.deadline ? new Date(job.deadline).toISOString() : null}
          />
        )}
      </div>

      {regionalPrice && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-8 flex items-start gap-3">
          <TrendingUp size={18} className="text-blue-700 shrink-0 mt-0.5" />
          <p className="text-sm text-blue-900">
            <strong>Regionaler Preisvergleich:</strong> Ähnliche {job.gewerk}-Aufträge im {regionalPrice.regionLabel} wurden
            zuletzt für durchschnittlich <strong>€{regionalPrice.avgPrice.toLocaleString('de-DE')}</strong> vergeben
            (Spanne €{regionalPrice.minPrice.toLocaleString('de-DE')} – €{regionalPrice.maxPrice.toLocaleString('de-DE')},
            basierend auf {regionalPrice.sampleSize} vergangenen Aufträgen).
          </p>
        </div>
      )}

      {job.awarded_subunternehmer_id && (
        <div className="mb-8">
          <ReviewForm jobId={id} existingReview={existingReview || undefined} />
        </div>
      )}

      {lineItems.length > 0 && offers.length > 0 && (
        <div className="mb-10">
          <h2 className="text-xl font-black text-[#17202a] mb-1">Angebote im direkten Vergleich</h2>
          <p className="text-sm text-slate-500 mb-4">Gleicher Leistungsumfang für alle Anbieter – echte Preisvergleichbarkeit.</p>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm bg-white min-w-[600px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left font-bold text-slate-700 px-4 py-3">Position</th>
                  {offers.map((offer) => (
                    <th key={offer.id} className="text-right font-bold text-[#17202a] px-4 py-3 whitespace-nowrap">
                      {offer.company_name}
                      <div className="flex items-center justify-end gap-1 mt-1 font-normal text-xs text-slate-500">
                        {offer.pricing_type === 'fixed' ? (
                          <span className="flex items-center gap-1 text-green-700"><ShieldCheck size={12} /> Festpreis</span>
                        ) : (
                          <span className="flex items-center gap-1"><Ruler size={12} /> Nach Aufmaß</span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lineItems.map((li) => (
                  <tr key={li.id} className="border-b border-slate-100">
                    <td className="px-4 py-3 text-slate-700">{li.title}</td>
                    {offers.map((offer) => {
                      const price = priceMap.get(offer.id)?.get(li.id)
                      return (
                        <td key={offer.id} className="px-4 py-3 text-right text-slate-600">
                          {price ? `€${price}` : '–'}
                        </td>
                      )
                    })}
                  </tr>
                ))}
                <tr className="bg-slate-50 font-black text-[#17202a]">
                  <td className="px-4 py-3">Gesamt</td>
                  {offers.map((offer) => (
                    <td key={offer.id} className="px-4 py-3 text-right">€{offer.price}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      <h2 className="text-xl font-black text-[#17202a] mb-4">
        {offers.length} Angebot{offers.length === 1 ? '' : 'e'}
      </h2>

      <div className="space-y-4">
        {offers.length === 0 && <p className="text-slate-500">Noch keine Angebote erhalten.</p>}
        {offers.map((offer) => {
          const isAwarded = job.awarded_subunternehmer_id === offer.subunternehmer_id
          return (
            <div key={offer.id} className={`bg-white border rounded-xl p-5 ${isAwarded ? 'border-green-400 ring-1 ring-green-200' : 'border-slate-200'}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-bold text-[#17202a] flex items-center gap-2 flex-wrap">
                    {offer.company_name}
                    {offer.verification_status === 'verified' && (
                      <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <BadgeCheck size={12} /> Verifiziert
                      </span>
                    )}
                    {isAwarded && <span className="text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">Beauftragt</span>}
                    {offer.pricing_type === 'fixed' ? (
                      <span className="text-xs font-bold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <ShieldCheck size={12} /> Festpreis garantiert
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Ruler size={12} /> Preis nach Aufmaß
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-slate-500">{offer.plz} {offer.ort}</div>
                  {responseTimeByOffer.has(offer.id) && (
                    <div className="flex items-center gap-1 mt-1 text-xs font-semibold text-green-700">
                      <Zap size={12} /> Antwortet meist {responseTimeByOffer.get(offer.id)}
                    </div>
                  )}
                  {offer.review_count > 0 && (
                    <div className="flex items-center gap-1 mt-1 text-sm text-slate-600">
                      <Star size={14} className="fill-[#f47b20] text-[#f47b20]" />
                      {offer.avg_rating} ({offer.review_count} Bewertung{offer.review_count === 1 ? '' : 'en'})
                    </div>
                  )}
                </div>
                <div className="text-xl font-black text-[#17202a]">€{offer.price}</div>
              </div>
              {offer.message && <p className="text-sm text-slate-600 mt-3">{offer.message}</p>}

              <div className="mt-4 pt-4 border-t border-slate-100 text-sm text-slate-700 space-y-1">
                <div>📧 {offer.email}</div>
                {offer.phone && <div>📞 {offer.phone}</div>}
              </div>

              <OfferChat offerId={offer.id} messages={messagesByOffer.get(offer.id) || []} currentUserId={user.id} />

              {!job.awarded_subunternehmer_id && offer.status === 'pending' && (
                <div className="mt-3">
                  <AwardButton jobId={id} offerId={offer.id} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
