import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/current-user'
import { TIERS } from '@/lib/tiers'
import PortalButton from '../../abo/PortalButton'

export default async function MitgliedschaftPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (user.role !== 'subunternehmer') redirect('/dashboard')

  const tierDef = user.subscriptionTier ? TIERS[user.subscriptionTier] : undefined

  const statusLabels: Record<string, { text: string; className: string }> = {
    active: { text: 'Aktiv', className: 'bg-green-100 text-green-700' },
    past_due: { text: 'Zahlung überfällig', className: 'bg-orange-100 text-orange-700' },
    canceled: { text: 'Gekündigt', className: 'bg-slate-100 text-slate-500' },
    inactive: { text: 'Kein Abo', className: 'bg-slate-100 text-slate-500' },
  }
  const status = statusLabels[user.subscriptionStatus] || statusLabels.inactive

  return (
    <div className="max-w-lg space-y-6">
      <div className="bg-white border border-slate-200 rounded-2xl p-6">
        <p className="text-sm text-slate-500 mb-1">Aktuelle Mitgliedschaft</p>
        <div className="flex items-center gap-2 mb-1">
          <p className="text-xl font-black text-slate-900">
            {tierDef ? tierDef.name : 'Kein aktives Abo'}
          </p>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${status.className}`}>{status.text}</span>
        </div>
        {tierDef && (
          <p className="text-sm text-slate-500">
            €{tierDef.priceEuroPerMonth} / Monat · {tierDef.billingNote}
          </p>
        )}
        {user.subscriptionCommittedUntil && new Date(user.subscriptionCommittedUntil) > new Date() && (
          <p className="text-sm text-orange-600 mt-2">
            Mindestlaufzeit bis {new Date(user.subscriptionCommittedUntil).toLocaleDateString('de-DE')} – eine Kündigung
            ist erst danach möglich.
          </p>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6">
        <h2 className="font-bold text-slate-900 mb-1">Zahlungsart</h2>
        <p className="text-sm text-slate-500 mb-4">
          Zahlungsmethode ändern, Rechnungsadresse anpassen oder das Abo kündigen — verwaltet über unseren
          sicheren Zahlungsanbieter Stripe.
        </p>
        {user.stripeCustomerId ? (
          <PortalButton />
        ) : (
          <p className="text-sm text-slate-400">Noch keine Zahlungsmethode hinterlegt.</p>
        )}
      </div>
    </div>
  )
}
