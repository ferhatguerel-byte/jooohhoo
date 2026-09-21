'use client'

import Link from 'next/link'

/**
 * Markiert die Notification als gelesen, sobald der Provider den Auftrag tatsächlich öffnet
 * (Klick auf die CTA) – nicht bereits beim Laden der Liste (Phase 3.6E §14: GET bleibt
 * side-effect-frei). Der Read-Request ist fire-and-forget und blockiert die Navigation nicht.
 * Führt zur bestehenden, unveränderten Provider-Auftragsansicht /dashboard/jobs – deren
 * eigene Zugriffskontrolle bleibt vollständig erhalten (keine neue Zugriffslücke).
 */
export default function MarkNotificationReadLink({ notificationId }: { notificationId: string }) {
  function handleClick() {
    fetch(`/api/match-notifications/${notificationId}/read`, { method: 'POST' }).catch(() => {})
  }

  return (
    <Link
      href="/dashboard/jobs"
      onClick={handleClick}
      className="inline-block bg-brand hover:bg-brand-hover text-white font-bold text-sm py-2 px-4 rounded-lg"
    >
      Auftrag ansehen →
    </Link>
  )
}
