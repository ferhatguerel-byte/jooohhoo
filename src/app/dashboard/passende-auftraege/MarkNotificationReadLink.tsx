'use client'

import Link from 'next/link'

/**
 * Markiert die Notification als gelesen, sobald der Provider den Auftrag tatsächlich öffnet
 * (Klick auf die CTA) – nicht bereits beim Laden der Liste (Phase 3.6E §14: GET bleibt
 * side-effect-frei). Der Read-Request ist fire-and-forget und blockiert die Navigation nicht.
 * Führt zur bestehenden, unveränderten Provider-Auftragsansicht /dashboard/jobs – deren
 * eigene Zugriffskontrolle bleibt vollständig erhalten (keine neue Zugriffslücke).
 *
 * Phase 3.6G: `?job=<jobId>` im Ziellink markiert diesen konkreten Klick als "Auftrag tatsächlich
 * geöffnet" für JOB_VIEWED (siehe /dashboard/jobs/page.tsx) – die bestehende Provider-Ansicht hat
 * keine eigene Job-Detail-Route (Phase 3.6G Teil 8: kleinster sauberer Mechanismus statt neuer
 * Architektur), sondern zeigt alle offenen Aufträge in einer Liste. Der Query-Parameter macht aus
 * dieser tatsächlichen Nutzerinteraktion (Klick auf "Auftrag ansehen") ein gezieltes Signal für
 * genau diesen einen Job, ohne die bestehende Listen-Seite umzubauen.
 */
export default function MarkNotificationReadLink({ notificationId, jobId }: { notificationId: string; jobId: string }) {
  function handleClick() {
    fetch(`/api/match-notifications/${notificationId}/read`, { method: 'POST' }).catch(() => {})
  }

  return (
    <Link
      href={`/dashboard/jobs?job=${jobId}`}
      onClick={handleClick}
      className="inline-block bg-brand hover:bg-brand-hover text-white font-bold text-sm py-2 px-4 rounded-lg"
    >
      Auftrag ansehen →
    </Link>
  )
}
