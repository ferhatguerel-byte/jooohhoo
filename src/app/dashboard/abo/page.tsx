import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/current-user'
import { getDb } from '@/lib/db'
import { TIERS, TIER_ORDER } from '@/lib/tiers'
import CheckoutButton from './CheckoutButton'
import PortalButton from './PortalButton'

export default async function AboPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (user.role !== 'subunternehmer') redirect('/dashboard')

  const currentTierDef = user.subscriptionTier ? TIERS[user.subscriptionTier] : undefined
  const hasActiveSub = user.subscriptionStatus === 'active' && !!currentTierDef

  const leadsUsedResult = await getDb().query(
    `SELECT COUNT(*)::int AS count FROM offers
     WHERE subunternehmer_id = $1 AND created_at >= date_trunc('month', now())`,
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
            <p className="text-xl font-black text-brand">{currentTierDef!.name}</p>
            <p className="text-sm text-slate-500 mt-1">
              {leadsUsed} Aufträge diesen Monat kontaktiert · unbegrenzter Zugriff
            </p>
            {user.subscriptionCancelAt ? (
              <p className="text-sm text-orange-600 mt-1">
                Gekündigt zum {new Date(user.subscriptionCancelAt).toLocaleDateString('de-DE')}
              </p>
            ) : (
              user.subscriptionCommittedUntil && new Date(user.subscriptionCommittedUntil) > new Date() && (
                <p className="text-sm text-slate-400 mt-1">
                  Laufende Vertragsperiode bis {new Date(user.subscriptionCommittedUntil).toLocaleDateString('de-DE')}
                </p>
              )
            )}
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
              <div className="text-3xl font-black text-slate-900 mb-1">€{tier.priceEuroPerMonth}</div>
              <div className="text-slate-400 text-sm mb-4">/Monat · {tier.billingNote}</div>
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
