import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ShieldCheck, Ruler } from 'lucide-react'
import { getCurrentUser } from '@/lib/current-user'
import { getDb } from '@/lib/db'
import OfferChat, { ChatMessage } from '@/components/OfferChat'

const STATUS_LABELS: Record<string, { text: string; className: string }> = {
  pending: { text: 'Ausstehend', className: 'bg-orange-100 text-orange-700' },
  accepted: { text: 'Beauftragt', className: 'bg-green-100 text-green-700' },
  declined: { text: 'Abgelehnt', className: 'bg-red-100 text-red-700' },
}

export default async function MeineAngebotePage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (user.role !== 'subunternehmer') redirect('/dashboard')

  const db = getDb()

  const offersResult = await db.query(
    `SELECT o.id AS offer_id, o.price, o.status AS offer_status, o.pricing_type, o.created_at,
            j.id AS job_id, j.title, j.gewerk, j.plz, j.ort, j.status AS job_status
     FROM offers o
     JOIN jobs j ON j.id = o.job_id
     WHERE o.subunternehmer_id = $1
     ORDER BY o.created_at DESC`,
    [user.id]
  )
  const offers = offersResult.rows

  const offerIds = offers.map((o) => o.offer_id)
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

  return (
    <div>
      <h1 className="text-2xl font-black text-[#17202a] mb-6">Meine Angebote</h1>

      <div className="space-y-4">
        {offers.length === 0 && <p className="text-slate-500">Sie haben noch keine Angebote abgegeben.</p>}
        {offers.map((offer) => {
          const status = STATUS_LABELS[offer.offer_status] || STATUS_LABELS.pending
          return (
            <div key={offer.offer_id} className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-start justify-between gap-4 mb-2 flex-wrap">
                <div>
                  <Link href={`/dashboard/jobs`} className="font-bold text-[#17202a] hover:underline">
                    {offer.title}
                  </Link>
                  <p className="text-sm text-slate-500">{offer.gewerk} · {offer.plz} {offer.ort}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${status.className}`}>{status.text}</span>
                  <span className="text-xs font-medium text-slate-400 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200">
                    Auftrag: {offer.job_status === 'open' ? 'Offen' : 'Geschlossen'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xl font-black text-[#17202a]">€{offer.price}</span>
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

              <OfferChat offerId={offer.offer_id} messages={messagesByOffer.get(offer.offer_id) || []} currentUserId={user.id} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
