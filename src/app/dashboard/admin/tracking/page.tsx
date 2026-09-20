import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { requireAdmin } from '@/lib/authorization'
import { getFunnelStats } from '@/lib/funnel-stats'

export const dynamic = 'force-dynamic'

function FunnelBar({
  label,
  count,
  total,
  color,
}: {
  label: string
  count: number
  total: number
  color: string
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-semibold text-slate-700">{label}</span>
        <span className="text-sm text-slate-500">
          {count} <span className="text-slate-400">({pct}%)</span>
        </span>
      </div>
      <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default async function TrackingDashboardPage() {
  await requireAdmin()

  const stats = await getFunnelStats()

  return (
    <div>
      <Link href="/dashboard/admin" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-brand mb-4">
        <ArrowLeft size={14} /> Zurück zum Admin-Dashboard
      </Link>
      <h1 className="text-2xl font-black text-slate-900 mb-2">Tracking-Dashboard</h1>
      <p className="text-slate-500 mb-8">Onboarding- und Aktivierungs-Funnel für Unternehmer und Aufträge.</p>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <h2 className="font-bold text-slate-900 mb-4">Unternehmer-Funnel</h2>
          <FunnelBar
            label="Registriert"
            count={stats.unternehmer.registered}
            total={stats.unternehmer.registered}
            color="bg-slate-400"
          />
          <FunnelBar
            label="Verifiziert"
            count={stats.unternehmer.verified}
            total={stats.unternehmer.registered}
            color="bg-blue-500"
          />
          <FunnelBar
            label="Aktives Abo"
            count={stats.unternehmer.activeSubscription}
            total={stats.unternehmer.registered}
            color="bg-accent"
          />
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <h2 className="font-bold text-slate-900 mb-4">Auftrags-Funnel</h2>
          <FunnelBar
            label="Eingestellt"
            count={stats.auftraege.posted}
            total={stats.auftraege.posted}
            color="bg-slate-400"
          />
          <FunnelBar
            label="Mind. ein Angebot erhalten"
            count={stats.auftraege.withOffer}
            total={stats.auftraege.posted}
            color="bg-blue-500"
          />
          <FunnelBar
            label="Vergeben"
            count={stats.auftraege.awarded}
            total={stats.auftraege.posted}
            color="bg-accent"
          />
        </div>
      </div>
    </div>
  )
}
