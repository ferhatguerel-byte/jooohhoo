import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/current-user'
import { getDb } from '@/lib/db'
import MarkNotificationReadLink from './MarkNotificationReadLink'

interface NotificationRow {
  id: string
  job_id: string
  created_at: string
  read_at: string | null
  title: string
  gewerk: string
  plz: string
  ort: string
  description: string
  budget_min: number | null
  budget_max: number | null
  deadline: string | null
}

/**
 * Phase 3.6E – Provider-Ansicht der eigenen Match-Notifications (match_notifications ist die
 * alleinige Autorisierungs-/Datengrundlage, nicht "alle offenen Jobs zum passenden Gewerk" –
 * ein Provider sieht hier nur Jobs, für die tatsächlich eine Notification für IHN existiert).
 *
 * Eine einzige Query, provider_id kommt ausschließlich aus der authentifizierten Session
 * (niemals aus einem Request-Parameter) – nutzt idx_match_notifications_provider
 * (provider_id, created_at DESC) aus Migration 0008. Explizite Spaltenliste statt SELECT *:
 * status/attempts/last_error/sent_at/match_score/job_match_id/matched_factors/missing_data/
 * exclusion_reason werden bewusst NICHT geladen – interne Matching-/Versanddaten gehören nicht
 * in die Provider-Oberfläche (Phase 3.6E §9/§10/§21). Der Score wird bewusst nicht angezeigt:
 * die Aussage ist "passender Auftrag", keine Punktzahl.
 */
export default async function PassendeAuftraegePage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (user.role !== 'subunternehmer') redirect('/dashboard')

  const db = getDb()
  const result = await db.query<NotificationRow>(
    `SELECT mn.id, mn.job_id, mn.created_at, mn.read_at,
            j.title, j.gewerk, j.plz, j.ort, j.description, j.budget_min, j.budget_max, j.deadline
     FROM match_notifications mn
     JOIN jobs j ON j.id = mn.job_id
     WHERE mn.provider_id = $1
     ORDER BY mn.created_at DESC
     LIMIT 50`,
    [user.id]
  )
  const notifications = result.rows

  return (
    <div>
      <h1 className="text-2xl font-black text-slate-900 mb-2">Passende Aufträge</h1>
      <p className="text-slate-500 mb-8">
        Diese Bauprojekte wurden von BAUVERSUS als passend zu Ihrem Unternehmensprofil erkannt.
      </p>

      {notifications.length === 0 && <p className="text-slate-500">Noch keine passenden Aufträge gefunden.</p>}

      <div className="space-y-4">
        {notifications.map((n) => {
          const unread = n.read_at === null
          return (
            <div
              key={n.id}
              className={`bg-white border rounded-xl p-5 ${unread ? 'border-brand/40 shadow-sm' : 'border-slate-200'}`}
            >
              <div className="flex items-start justify-between gap-3 mb-1">
                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                  {unread && <span className="w-2 h-2 rounded-full bg-accent shrink-0" aria-label="Ungelesen" />}
                  {n.title}
                </h3>
                <span className="text-xs text-slate-400 whitespace-nowrap">
                  {new Date(n.created_at).toLocaleDateString('de-DE')}
                </span>
              </div>
              <p className="text-sm text-slate-500 mb-2">
                {n.gewerk} · {n.plz} {n.ort}
              </p>
              {(n.budget_min || n.budget_max) && (
                <p className="text-sm text-slate-600 mb-2">
                  Budget: {n.budget_min ? `€${n.budget_min}` : '?'}
                  {n.budget_max ? ` – €${n.budget_max}` : ''}
                </p>
              )}
              {n.deadline && (
                <p className="text-sm text-slate-600 mb-2">
                  Gewünschter Termin: {new Date(n.deadline).toLocaleDateString('de-DE')}
                </p>
              )}
              <p className="text-sm text-slate-600 mb-4 line-clamp-2">{n.description}</p>
              <MarkNotificationReadLink notificationId={n.id} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
