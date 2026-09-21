import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/current-user'
import { getDb } from '@/lib/db'
import { TIERS, TIER_ORDER } from '@/lib/tiers'
import { reconcileUserStripeSubscription } from '@/lib/billing/reconcile-subscription'
import CheckoutButton from './CheckoutButton'
import PortalButton from './PortalButton'

export default async function AboPage({ searchParams }: { searchParams: Promise<{ success?: string }> }) {
  const { success } = await searchParams
  let user = await getCurrentUser()
  if (!user) redirect('/login')
  if (user.role !== 'subunternehmer') redirect('/dashboard')

  // Phase 4.2 (Teil K) – Fallback gegen die Lücke zwischen erfolgreicher Stripe-Zahlung und dem
  // (ggf. verspäteten) Webhook: kommt der Nutzer frisch von einem erfolgreichen Checkout zurück
  // (`?success=1`) und zeigt die lokale DB noch KEIN aktives Abo, wird Stripe genau EINMAL
  // gezielt live abgefragt (Reconciliation, nicht blind gewartet, nicht die UI ungeprüft auf
  // "aktiv" gesetzt – Stripe bleibt Source of Truth). War der Webhook zu diesem Zeitpunkt bereits
  // durch, ist dieser Aufruf ein No-op (Reconciliation liefert denselben, bereits aktiven Zustand).
  if (success === '1' && user.subscriptionStatus !== 'active') {
    await reconcileUserStripeSubscription(user.id)
    // getCurrentUser() ist React.cache()-memoisiert für die Dauer dieses Requests – nach dem
    // Reconciliation-Schreiben muss der Nutzer frisch aus der DB gelesen werden, sonst zeigt diese
    // Server-Response weiterhin den zwischengespeicherten, veralteten Zustand.
    const refreshed = await getDb().query(
      `SELECT subscription_status, subscription_tier, subscription_cancel_at, subscription_committed_until
       FROM users WHERE id = $1`,
      [user.id]
    )
    const row = refreshed.rows[0]
    if (row) {
      user = {
        ...user,
        subscriptionStatus: row.subscription_status,
        subscriptionTier: row.subscription_tier,
        subscriptionCancelAt: row.subscription_cancel_at,
        subscriptionCommittedUntil: row.subscription_committed_until,
      }
    }
  }

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
          const blockedDowngrade = hasActiveSub && user.subscriptionTier === 'yearly' && tierId === 'monthly' && !user.subscriptionCancelAt
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
              ) : blockedDowngrade ? (
                <div className="text-center">
                  <div className="text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-lg py-3 px-2">
                    Erst nach Ablauf der Jahrespaket-Laufzeit verfügbar. Bitte zuerst über „Vertrag kündigen&rdquo; kündigen.
                  </div>
                </div>
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
