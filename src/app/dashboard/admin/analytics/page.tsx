import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { requireAdmin } from '@/lib/authorization'
import { resolveAnalyticsDateRange, getMatchingFunnelReport } from '@/lib/analytics-queries'
import AnalyticsRangeFilter from './AnalyticsRangeFilter'

export const dynamic = 'force-dynamic'

/**
 * Phase 3.6H – internes Matching-Analytics-Dashboard für Admins. Zugriffsschutz ausschließlich
 * über die bestehende zentrale requireAdmin()-Funktion (src/lib/authorization.ts) – keine eigene
 * Admin-Auth, kein neuer öffentlicher API-Endpunkt. Direkte serverseitige Query statt einer
 * Route (Phase 3.6H §17: "direkte Server-Query bevorzugen").
 *
 * Zeigt AUSSCHLIESSLICH aggregierte Zahlen aus analytics_events (Phase 3.6G) – keine IDs, keine
 * E-Mail-Adressen/Namen/Nachrichten, keine Score-/Matching-Interna, keine Bewertung der
 * Matching-Qualität. Reine Datendarstellung.
 */
export default async function MatchingAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>
}) {
  await requireAdmin()

  const params = await searchParams
  const range = resolveAnalyticsDateRange(params)
  const report = await getMatchingFunnelReport(range)

  return (
    <div>
      <Link href="/dashboard/admin" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-brand mb-4">
        <ArrowLeft size={14} /> Zurück zum Admin-Dashboard
      </Link>
      <h1 className="text-2xl font-black text-slate-900 mb-2">Matching Analytics</h1>
      <p className="text-slate-500 mb-6">
        Wie sich Aufträge durch den Matching-Funnel bewegen – ausschließlich auf Basis tatsächlich
        gespeicherter Analytics-Events, keine Schätzungen.
      </p>

      <AnalyticsRangeFilter initial={{ range: range.preset, from: params.from, to: params.to }} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <KpiCard label="Aufträge" value={report.counts.projectCreated} />
        <KpiCard label="Matches" value={report.counts.matchCreated} />
        <KpiCard label="Notifications" value={report.counts.matchNotificationCreated} />
        <KpiCard label="E-Mails" value={report.counts.matchEmailSent} />
        <KpiCard label="Gelesen" value={report.counts.matchNotificationRead} />
        <KpiCard label="Job Views" value={report.counts.jobViewed} />
        <KpiCard label="Angebote" value={report.counts.offerReceived} />
        <KpiCard label="Vergaben" value={report.counts.offerAccepted} />
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-8">
        <h2 className="font-bold text-slate-900 mb-1">Matching Funnel</h2>
        <p className="text-xs text-slate-400 mb-4">
          Event-Counts (Häufigkeit des Ereignisses) – keine automatische Aussage über den Anteil
          derselben Aufträge/Provider.
        </p>
        <div className="space-y-3">
          <FunnelStep label="Aufträge erstellt" value={report.counts.projectCreated} />
          <FunnelStep label="Matches erzeugt" value={report.counts.matchCreated} />
          <FunnelStep label="Notifications erzeugt" value={report.counts.matchNotificationCreated} />
          <FunnelStep label="E-Mails versendet" value={report.counts.matchEmailSent} />
          <FunnelStep label="Notifications gelesen" value={report.counts.matchNotificationRead} />
          <FunnelStep label="Aufträge angesehen" value={report.counts.jobViewed} />
          <FunnelStep label="Angebote abgegeben" value={report.counts.offerReceived} />
          <FunnelStep label="Aufträge vergeben" value={report.counts.offerAccepted} />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-8">
        <h2 className="font-bold text-slate-900 mb-1">Entity-Conversion (eindeutige Aufträge/Notifications)</h2>
        <p className="text-xs text-slate-400 mb-4">
          Anteil derselben Aufträge bzw. Notifications, die den jeweils nächsten Schritt erreicht
          haben – ermittelt über job_id/notification_id, nicht durch Division unabhängiger
          Event-Counts.
        </p>
        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          <ConversionRow label="Job → mind. ein Match" rate={report.conversionRates.matchPerJob} />
          <ConversionRow label="Match-Job → mind. eine Notification" rate={report.conversionRates.notificationPerMatchedJob} />
          <ConversionRow label="Notification → gelesen" rate={report.conversionRates.readPerNotification} />
          <ConversionRow label="Notification-Job → Job View" rate={report.conversionRates.viewPerNotifiedJob} />
          <ConversionRow label="Job View → Angebot" rate={report.conversionRates.offerPerViewedJob} />
          <ConversionRow label="Angebot → Vergabe" rate={report.conversionRates.awardPerOfferedJob} />
        </div>
      </div>

      {report.daily.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 overflow-x-auto">
          <h2 className="font-bold text-slate-900 mb-4">Zeitlicher Verlauf (UTC-Tage)</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">
                <th className="pb-2 pr-4">Datum</th>
                <th className="pb-2 pr-4">Aufträge</th>
                <th className="pb-2 pr-4">Matches</th>
                <th className="pb-2 pr-4">Notifications</th>
                <th className="pb-2 pr-4">Angebote</th>
                <th className="pb-2">Vergaben</th>
              </tr>
            </thead>
            <tbody>
              {report.daily.map((row) => (
                <tr key={row.day} className="border-t border-slate-100">
                  <td className="py-2 pr-4 text-slate-700">{row.day}</td>
                  <td className="py-2 pr-4 text-slate-700">{row.jobs}</td>
                  <td className="py-2 pr-4 text-slate-700">{row.matches}</td>
                  <td className="py-2 pr-4 text-slate-700">{row.notifications}</td>
                  <td className="py-2 pr-4 text-slate-700">{row.offers}</td>
                  <td className="py-2 text-slate-700">{row.awards}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function KpiCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-black text-slate-900">{value.toLocaleString('de-DE')}</p>
    </div>
  )
}

function FunnelStep({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <span className="text-sm font-bold text-slate-900">{value.toLocaleString('de-DE')}</span>
    </div>
  )
}

function ConversionRow({ label, rate }: { label: string; rate: number | null }) {
  return (
    <div className="flex items-center justify-between border border-slate-100 rounded-lg px-3 py-2">
      <span className="text-slate-600">{label}</span>
      <span className="font-bold text-slate-900">{rate === null ? '–' : `${Math.round(rate * 1000) / 10}%`}</span>
    </div>
  )
}
