import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/current-user'
import { getDb } from '@/lib/db'
import { TIERS, TIER_ORDER } from '@/lib/tiers'
import CheckoutButton from './CheckoutButton'
import PortalButton from './PortalButton'

export default async function AboPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (user.role !== 'auftraggeber') redirect('/dashboard')

  const hasActiveSub = user.subscriptionStatus === 'active' && user.subscriptionTier

  const leadsUsedResult = await getDb().query(
    `SELECT COUNT(*)::int AS count FROM lead_unlocks
     WHERE auftraggeber_id = $1 AND unlocked_at >= date_trunc('month', now())`,
    [user.id]
  )
  const leadsUsed = leadsUsedResult.rows[0].count

  return (
    <div>
      <h1 className="text-2xl font-black text-slate-900 mb-2">Abo</h1>

      {hasActiveSub && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-8 flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-sm text-slate-500">Aktuelles Abo</p>
            <p className="text-xl font-black text-brand">{TIERS[user.subscriptionTier!].name}</p>
            <p className="text-sm text-slate-500 mt-1">
              {leadsUsed} / {TIERS[user.subscriptionTier!].leadsPerMonth} Kontakte diesen Monat freigeschaltet
            </p>
          </div>
          <PortalButton />
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        {TIER_ORDER.map((tierId) => {
          const tier = TIERS[tierId]
          const isCurrent = user.subscriptionTier === tierId && hasActiveSub
          return (
            <div key={tier.id} className={`rounded-2xl p-6 border-2 ${isCurrent ? 'border-brand' : 'border-slate-200'} bg-white`}>
              <div className="text-lg font-bold text-slate-900 mb-1">{tier.name}</div>
              <div className="text-3xl font-black text-slate-900 mb-1">€{tier.priceEuro}</div>
              <div className="text-slate-400 text-sm mb-4">/Monat</div>
              <ul className="space-y-2 mb-6 text-sm text-slate-600">
                {tier.features.map((f) => <li key={f}>✓ {f}</li>)}
              </ul>
              {isCurrent ? (
                <div className="text-center text-sm font-bold text-brand py-3">Aktueller Plan</div>
              ) : (
                <CheckoutButton tier={tier.id} label={hasActiveSub ? 'Wechseln' : 'Abo abschließen'} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
